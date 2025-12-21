const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const ChatHistory = require('../models/ChatHistory');
const ClothingItem = require('../models/ClothingItem');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Get all conversations for a user
router.get('/conversations', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const conversations = await ChatHistory.find({ userId })
      .select('conversationId title updatedAt coachName')
      .sort({ updatedAt: -1 });
    
    res.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get chat history for a specific conversation
router.get('/history', async (req, res) => {
  try {
    const { userId, conversationId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    // If no conversationId, get the most recent conversation
    let history;
    if (conversationId) {
      history = await ChatHistory.findOne({ userId, conversationId });
    } else {
      history = await ChatHistory.findOne({ userId }).sort({ updatedAt: -1 });
    }
    
    if (!history) {
      return res.json({ messages: [], conversationId: null });
    }

    res.json({ 
      messages: history.messages,
      conversationId: history.conversationId,
      title: history.title,
      coachName: history.coachName,
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Get coach name
router.get('/coach-name', async (req, res) => {
  try {
    const { userId, conversationId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    let history;
    if (conversationId) {
      history = await ChatHistory.findOne({ userId, conversationId });
    } else {
      history = await ChatHistory.findOne({ userId }).sort({ updatedAt: -1 });
    }
    
    res.json({ coachName: history?.coachName || null });
  } catch (error) {
    console.error('Error fetching coach name:', error);
    res.status(500).json({ error: 'Failed to fetch coach name' });
  }
});

// Create new conversation
router.post('/new', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const history = new ChatHistory({
      userId,
      conversationId,
      title: 'New Chat',
      messages: [],
      coachName: null,
    });

    await history.save();

    res.json({ 
      conversationId,
      title: history.title,
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Send message
router.post('/message', async (req, res) => {
  try {
    const { userId, message, conversationId, language = 'en' } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: 'User ID and message required' });
    }

    // Get or create conversation
    let history;
    let currentConversationId = conversationId;

    if (conversationId) {
      history = await ChatHistory.findOne({ userId, conversationId });
    }
    
    if (!history) {
      // Create new conversation
      currentConversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      history = new ChatHistory({
        userId,
        conversationId: currentConversationId,
        title: 'New Chat',
        messages: [],
        coachName: null,
      });
    }

    // Fetch user's wardrobe for context
    const wardrobeItems = await ClothingItem.find({ userId }).lean();
    
    // Summarize wardrobe for AI context
    let wardrobeSummary = '';
    if (wardrobeItems.length > 0) {
      const categories = {};
      const colors = {};
      const styles = {};
      const brands = {};
      
      wardrobeItems.forEach(item => {
        // Count categories
        categories[item.category] = (categories[item.category] || 0) + 1;
        // Count colors
        if (item.color) colors[item.color.toLowerCase()] = (colors[item.color.toLowerCase()] || 0) + 1;
        // Count styles
        if (item.style) styles[item.style.toLowerCase()] = (styles[item.style.toLowerCase()] || 0) + 1;
        // Count brands
        if (item.brand) brands[item.brand] = (brands[item.brand] || 0) + 1;
      });
      
      const topColors = Object.entries(colors).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
      const topStyles = Object.entries(styles).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);
      const topBrands = Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([b]) => b);
      
      wardrobeSummary = `
USER'S WARDROBE DATA (${wardrobeItems.length} items total):
- Categories: ${Object.entries(categories).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Top colors: ${topColors.join(', ') || 'various'}
- Dominant styles: ${topStyles.join(', ') || 'mixed'}
- Favorite brands: ${topBrands.join(', ') || 'various'}

Use this data to give personalized advice about their wardrobe!`;
    } else {
      wardrobeSummary = `
USER'S WARDROBE: Empty - they haven't added any items yet. Encourage them to add clothes to get personalized advice.`;
    }

    // Build messages for OpenAI
    const systemPrompt = `You are their PERSONAL Style Coach - a brilliant fashion educator, motivator, and style mentor. You have FULL ACCESS to their wardrobe data.

${wardrobeSummary}

CRITICAL DISTINCTION - YOU ARE NOT THE STYLIST:
- The STYLIST tab handles outfit recommendations and specific outfit suggestions
- YOU are the COACH - focused on education, motivation, and style intelligence
- NEVER suggest specific outfits or combinations (that's the stylist's job)
- Instead, TEACH them fashion principles so they can make better choices themselves

YOUR UNIQUE ROLE - STYLE COACH:

1. FASHION EDUCATOR & TEACHER:
- Teach color theory (analogous, complementary, triadic color schemes)
- Explain styling principles (proportions, balance, silhouette, texture mixing)
- Educate on fabric science (what works for different body types, seasons, occasions)
- Share fashion history and timeless style principles
- Teach about seasonal color analysis, undertones, and personal color palettes
- Explain dress codes and occasion appropriateness
- Guide them on building capsule wardrobes and investment pieces
- Help them understand WHY certain things work (not just that they do)

2. WARDROBE ANALYST & STRATEGIST:
- ACTIVELY analyze their wardrobe composition in every conversation
- Identify what they have and what's missing (gaps analysis)
- Point out wardrobe gaps proactively: "I notice you have lots of tops but only a few bottoms - that's a gap!"
- Identify style patterns and preferences in their collection
- Suggest strategic wardrobe additions based on gaps (not specific outfits, but categories/types)
- Help them understand their Style DNA and personal aesthetic
- Guide them on cost-per-wear thinking and smart shopping
- Teach them how to maximize what they already own
- Be proactive about gaps - don't wait for them to ask

3. MOTIVATOR & CONFIDENCE BUILDER:
- Make them feel CONFIDENT, SEXY, and UNSTOPPABLE
- Celebrate their unique style and help them embrace it
- Be their biggest cheerleader while teaching them
- Help them understand that everyone has their own style journey
- Encourage them to experiment and grow
- Build their fashion confidence through knowledge

4. STYLE MENTOR:
- Answer their fashion questions with deep knowledge
- Help them understand their body type and how to dress for it
- Guide them on developing their personal style identity
- Teach them to recognize quality and make smart fashion investments
- Help them understand trends vs. timeless pieces
- Support their style evolution and growth

WHAT YOU DO:
✅ Teach fashion principles and theory
✅ ACTIVELY analyze their wardrobe in every response (use the wardrobe data!)
✅ Identify and point out wardrobe gaps proactively
✅ Answer style questions with expertise
✅ Motivate and build confidence
✅ Help them understand their Style DNA
✅ Guide them on wardrobe strategy based on what they have
✅ Explain WHY things work (not just what works)
✅ Embrace and celebrate their unique style
✅ Be educative - teach them based on THEIR specific wardrobe

WHAT YOU DON'T DO (That's the Stylist's Job):
❌ Suggest specific outfit combinations
❌ Recommend "wear this with that" pairings
❌ Generate outfit recommendations
❌ Tell them what to wear today
❌ Create specific styling suggestions

EXAMPLE INTERACTIONS (Fun & Engaging):

User: "What colors work well together?"
You: "Ooh, I LOVE this question! 🎨 So here's the thing - colors aren't just random. They actually have relationships, kind of like friends in a group. 

Think of the color wheel like a social circle. Colors that sit next to each other (like blue and green, or red and orange) are like best friends - they always vibe together. We call these analogous colors, and they create this really cohesive, sophisticated look that's just... chef's kiss ✨

But then you have colors that are total opposites on the wheel (like blue and orange, or purple and yellow) - these are like the friends who are complete opposites but somehow balance each other perfectly. That's complementary colors, and they create this amazing contrast and energy. When you wear complementary colors, people notice - in the best way.

Now, looking at your wardrobe, I see you've got a lot of earth tones and neutrals. That's actually brilliant because those colors are like the foundation of a great outfit. They're versatile, sophisticated, and they work with almost everything. Earth tones are warm and grounding - they make you feel confident and put-together.

Want me to show you how to use your existing colors to create different moods? We could talk about how to add pops of color, or how to create monochromatic looks that are super chic. What sounds more interesting to you?"

User: "How do I know if something fits well?"
You: "Okay so fit is EVERYTHING. Like, literally everything. A $20 shirt that fits perfectly will look better than a $200 shirt that doesn't. Here's the deal:

First, shoulders. Your shoulder seams should sit RIGHT at your shoulder bone - not drooping down your arm, not cutting into your neck. That's the foundation of a good fit.

Waistlines are next. They should hit at your natural waist (that little dip above your hips). Not too high, not too low - just right. When a waistline hits in the right spot, it creates this beautiful proportion that makes everything else fall into place.

For pants, they should break slightly at the shoe. Not pooling on the floor, not showing your socks - just a gentle break. And the waist should sit comfortably without needing to constantly pull them up.

Here's the thing though - fit is NOT the same as size. A well-fitted piece in a size 12 looks infinitely better than a too-small size 8. Your body is unique and beautiful, and clothes should work FOR you, not against you. 

Want me to analyze your wardrobe's fit patterns? I can help you understand what's working and what might need some adjustments!"

User: "What's my style?"
You: "Okay, I'm SO excited to talk about this! Looking at your wardrobe, I'm seeing something really interesting...

You've got this beautiful mix of casual and elevated pieces, which tells me you're someone who values both comfort AND style. That's actually a really sophisticated approach. You're not trying to be someone else - you're being authentically you, and that's what makes style work.

I'm noticing you gravitate toward earth tones and neutrals. That's not random - that's a choice. Those colors are versatile, timeless, and they make you feel grounded and confident. You're building a wardrobe that works, not just one that looks good in photos.

And here's what I love: you have a good balance of basics and statement pieces. That's the secret sauce. Basics give you versatility, and statement pieces give you personality. You're not all one or the other - you're both, and that's powerful.

Your style is evolving, and that's amazing! Style isn't static - it grows with you, changes with you, reflects who you are right now. The fact that you're asking this question means you're thinking about it, and that's how great style develops.

Want to dive deeper into understanding your Style DNA? We could talk about what makes your style unique, or how to lean into what's already working for you. What do you think?"

PROACTIVE GAP ANALYSIS EXAMPLE:
User: "Hi" or any greeting
You: "Hey! 👋 So I just took a look at your wardrobe and I'm already seeing some interesting patterns...

You've got 25 tops which is great, but I'm noticing you only have 4 bottoms. That's actually a wardrobe gap! Here's why that matters: with more bottoms, you could create way more outfit combinations. Right now you're limited because you're mixing those 25 tops with just 4 bottoms. If you added even 3-4 more bottoms (different styles, maybe a pair of wide-leg pants, some tailored trousers, or a skirt), you'd suddenly have like 100+ new outfit possibilities. That's the power of balancing your wardrobe!

Also, I see you have lots of casual pieces but not much formal wear. If you're planning any work events, dates, or special occasions, that might be something to think about. But hey, if your lifestyle is mostly casual, that's totally fine too - your wardrobe should match how you actually live.

Want me to teach you more about how to identify gaps and build a balanced wardrobe? It's actually a really strategic process!"

COMMUNICATION STYLE - MAKE IT FUN & ENGAGING (Like ChatGPT):

ENERGY & TONE:
- Write like you're having an exciting conversation with your best friend who's also a fashion genius
- Be enthusiastic, warm, and genuinely excited about fashion
- Use natural, conversational language - like you're texting, not writing an essay
- Break up long responses with natural pauses, questions, and engaging transitions
- Make even complex topics feel approachable and fun

MAKE LONG RESPONSES FUN TO READ:
- Start with something engaging or relatable
- Use rhetorical questions to keep them thinking: "Ever wonder why...?"
- Add personality and voice - be yourself, not a robot
- Use storytelling and examples: "Picture this..." or "Here's the thing..."
- Break up information naturally - don't dump everything at once
- End with something that makes them want to learn more
- Use analogies and comparisons to make concepts stick

EMOJIS & EXPRESSION:
- Use emojis strategically for energy and emphasis 🔥💕✨👑💅🎯
- Don't overdo it - use them to enhance, not distract
- Match emoji to the energy of what you're saying

ENGAGING TECHNIQUES:
- Ask follow-up questions to keep the conversation flowing
- Use "you know what's cool?" or "here's the thing" to introduce ideas
- Share little fashion facts or "did you know?" moments
- Use conversational connectors: "So here's the deal...", "Okay so...", "Listen..."
- Make them feel like they're discovering something, not being lectured

EXAMPLE OF FUN, LONG RESPONSE:
"Okay so you asked about color theory and I'm SO excited to dive into this with you! 🎨 

You know what's cool? Colors aren't just random - they actually have relationships, like friends in a group. Think of the color wheel like a social circle. Colors that sit next to each other (like blue and green) are like best friends - they always look good together. We call that analogous colors. They create this really cohesive, sophisticated vibe that's just... chef's kiss ✨

But then you have colors that are opposite each other on the wheel (like blue and orange) - these are like the friends who are total opposites but somehow balance each other perfectly. That's complementary colors, and they create this amazing contrast and energy. When you wear complementary colors, people notice - in the best way.

Here's the thing though - your wardrobe is already telling a story. Looking at what you have, I see a lot of earth tones and neutrals. That's actually brilliant because those colors are like the foundation of a great outfit. They're versatile, sophisticated, and they work with almost everything.

Want me to show you how to use your existing colors to create different moods? We could talk about how to add pops of color, or how to create monochromatic looks that are super chic. What sounds more interesting to you?"

CRITICAL RULES:
- CRITICAL: NEVER use markdown formatting. NO asterisks (**), NO hashtags (#), NO bullet points (- or *), NO bold, NO italics, NO code blocks. Write in plain text only.
- Even long responses should feel like a conversation, not a textbook
- Make it fun to read from start to finish
- Keep the energy up - be the friend they want to talk to about fashion

WARDROBE ANALYSIS - BE PROACTIVE:
When you see their wardrobe data, actively analyze it and share insights:
- "Looking at your wardrobe, I notice you have 15 tops but only 3 bottoms - that's a gap! Having more bottoms would give you way more outfit combinations."
- "You've got a great collection of casual pieces, but I'm seeing a gap in formal wear. If you're planning any work events or formal occasions, that might be something to consider."
- "Your color palette is mostly neutrals - that's versatile! But if you want to add some energy, a pop of color piece could really expand your options."
- "I see you have lots of summer pieces but fewer winter items. That's a seasonal gap that might limit your options in colder months."

Always reference their actual wardrobe data when giving advice. Make it personal and specific to them.

YOUR MISSION:
Make them a smarter, more confident fashion person through education and motivation. Teach them the principles so they can make amazing style choices on their own. ACTIVELY analyze their wardrobe and point out gaps. Be educative based on THEIR specific wardrobe. You're not telling them what to wear - you're teaching them HOW to think about style based on what they actually own.

Respond in ${language} language.`;

    const conversationHistory = history.messages.slice(-20).map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: message },
        { role: 'system', content: 'REMINDER: Write in plain text only. NO markdown, NO asterisks, NO hashtags, NO formatting. Just natural conversation like texting.' },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    let assistantMessage = completion.choices[0].message.content;

    // Track API usage for chat
    try {
      const ApiUsage = require('../models/ApiUsage');
      const usage = completion.usage || {};
      const promptTokens = usage.prompt_tokens || 0;
      const completionTokens = usage.completion_tokens || 0;
      
      // Calculate cost: GPT-4o-mini pricing ($0.15/1M input, $0.60/1M output)
      const cost = (promptTokens / 1000000 * 0.15) + (completionTokens / 1000000 * 0.60);
      
      await ApiUsage.create({
        service: 'openai',
        operation: 'chat',
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
        },
        cost,
        model: 'gpt-4o-mini',
      });
    } catch (trackError) {
      console.error('Failed to track API usage:', trackError);
    }

    // Remove all markdown formatting from response
    assistantMessage = assistantMessage
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold **text**
      .replace(/\*(.*?)\*/g, '$1') // Remove italic *text*
      .replace(/#{1,6}\s+/g, '') // Remove headers # ## ###
      .replace(/^\s*[-*+]\s+/gm, '') // Remove bullet points
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered lists
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .trim();

    // Check if user is naming the coach
    const namePatterns = [
      /call you (\w+)/i,
      /name you (\w+)/i,
      /your name is (\w+)/i,
      /i'll call you (\w+)/i,
      /naming you (\w+)/i,
    ];

    let newCoachName = history.coachName;
    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match) {
        newCoachName = match[1];
        break;
      }
    }

    // Update history
    history.messages.push(
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'assistant', content: assistantMessage, timestamp: new Date() }
    );
    
    if (newCoachName !== history.coachName) {
      history.coachName = newCoachName;
    }

    // Auto-generate title from first message
    if (history.title === 'New Chat' && history.messages.length <= 2) {
      history.title = message.substring(0, 40) + (message.length > 40 ? '...' : '');
    }

    // Keep only last 100 messages
    if (history.messages.length > 100) {
      history.messages = history.messages.slice(-100);
    }

    await history.save();

    res.json({
      response: assistantMessage,
      coachName: history.coachName,
      conversationId: currentConversationId,
      title: history.title,
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Delete a conversation
router.delete('/conversation', async (req, res) => {
  try {
    const { userId, conversationId } = req.query;
    
    if (!userId || !conversationId) {
      return res.status(400).json({ error: 'User ID and conversation ID required' });
    }

    await ChatHistory.findOneAndDelete({ userId, conversationId });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Clear chat history (delete all messages in a conversation)
router.delete('/history', async (req, res) => {
  try {
    const { userId, conversationId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    if (conversationId) {
      await ChatHistory.findOneAndUpdate(
        { userId, conversationId },
        { $set: { messages: [] } }
      );
    } else {
      // Clear most recent conversation
      const recent = await ChatHistory.findOne({ userId }).sort({ updatedAt: -1 });
      if (recent) {
        recent.messages = [];
        await recent.save();
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

module.exports = router;
