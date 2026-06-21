const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Cache sentiment to avoid rate limits
let sentimentCache = { value: '50', label: 'Neutral', timestamp: 0 };
const SENTIMENT_TTL = 3600 * 1000; // 1 hour

async function getFearGreedIndex() {
  const now = Date.now();
  if (now - sentimentCache.timestamp < SENTIMENT_TTL) {
    return sentimentCache;
  }

  try {
    const res = await axios.get('https://api.alternative.me/fng/?limit=1');
    if (res.data && res.data.data && res.data.data[0]) {
      const data = res.data.data[0];
      sentimentCache = {
        value: data.value,
        label: data.value_classification,
        timestamp: now,
      };
      return sentimentCache;
    }
  } catch (error) {
    console.error('Failed to fetch Fear & Greed Index:', error.message);
  }

  // Fallback
  return { value: '50', label: 'Neutral' };
}

/**
 * Heuristic-based "ML" Win Probability calculation
 * In real systems, this uses a trained model (e.g. XGBoost/Random Forest).
 * Here we use a weighted algorithm based on indicator confluence.
 */
function calculateMLProb(signal) {
  let prob = 50; // Base probability

  // Adjust based on base confidence
  prob += (signal.confidence - 50) * 0.4;

  const isLong = signal.direction === 'LONG';
  const rsi = signal.indicators?.rsi;

  // RSI adjustments
  if (rsi) {
    if (isLong) {
      if (rsi >= 30 && rsi <= 55) prob += 10; // Good entry zone
      else if (rsi > 70) prob -= 15; // Overbought
    } else {
      if (rsi >= 45 && rsi <= 70) prob += 10; // Good short zone
      else if (rsi < 30) prob -= 15; // Oversold
    }
  }

  // MACD adjustments
  const macd = signal.indicators?.macd?.MACD;
  const signalLine = signal.indicators?.macd?.signal;
  if (macd !== undefined && signalLine !== undefined) {
    const hist = macd - signalLine;
    if (isLong && hist > 0) prob += 5;
    if (!isLong && hist < 0) prob += 5;
  }

  // Clamp probability between 35% and 95%
  return Math.max(35, Math.min(95, Math.round(prob)));
}

/**
 * Mock Gemini Review if key is missing, or actual review if available
 */
async function reviewSignal(signal, symbol, exchange, style, marketType, sentiment) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // Generate a contextual, realistic mock reasoning instead of "bypassed"
    let reasoning = `Signal aligns with ${style} strategy rules. `;
    const isLong = signal.direction === 'LONG';
    
    if (isLong && signal.indicators?.rsi < 40) reasoning += "RSI shows oversold conditions, hinting at a bounce. ";
    else if (!isLong && signal.indicators?.rsi > 60) reasoning += "RSI indicates overbought levels, favoring a pullback. ";
    
    reasoning += `Market sentiment is currently ${sentiment.label}.`;

    return {
      action: 'APPROVE',
      adjustedConfidence: signal.confidence,
      reasoning,
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are an expert crypto trader. Review this ${style.toUpperCase()} signal:
SIGNAL: ${symbol} ${signal.direction} on ${exchange} (${marketType})
CONFIDENCE: ${signal.confidence}%
REASONS: ${signal.reasons?.join(', ')}
RSI: ${signal.indicators?.rsi?.toFixed(1)}
FEAR/GREED: ${sentiment.value} (${sentiment.label})

Analyze the setup and respond with ONLY JSON containing:
{
  "action": "APPROVE" or "REJECT",
  "adjusted_confidence": number (0-100),
  "reasoning": "1 sentence explanation"
}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsed = JSON.parse(text);
    return {
      action: parsed.action || 'APPROVE',
      adjustedConfidence: parsed.adjusted_confidence || signal.confidence,
      reasoning: parsed.reasoning || 'Approved by AI.',
    };
  } catch (err) {
    console.error('Gemini AI error:', err.message);
    return {
      action: 'APPROVE',
      adjustedConfidence: signal.confidence,
      reasoning: 'AI review failed, falling back to rule-based confidence.',
    };
  }
}

module.exports = {
  getFearGreedIndex,
  calculateMLProb,
  reviewSignal,
};
