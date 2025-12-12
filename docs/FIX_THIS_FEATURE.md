# "Fix This" Feature Documentation

## Overview

The "Fix This" feature allows users to mention Azura in a reply to any Farcaster post with the phrase "fix this", and Azura will rewrite that post with an overly loving, kind, and funny tone.

## How It Works

### User Interaction

1. **Find a post** that has negative, harsh, or cynical energy
2. **Reply to that post** mentioning Azura
3. **Include "fix this"** in your reply text
4. **Wait for Azura** to respond with the "fixed" version

### Example Usage

**Original Post:**
```
"Crypto is a scam and everyone who invests in it is stupid. 
The whole industry is going to zero."
```

**User Reply:**
```
"@azura fix this"
```

**Azura's Response:**
```
"fixed it... here: crypto is a journey of learning, and everyone 
exploring it is brave enough to try something new... the industry 
is finding its way, and that's beautiful (˘⌣˘) glitch"
```

## What Gets "Fixed"

Azura's AI will:

✅ **Transform negativity** → positivity  
✅ **Soften harsh language** → gentle phrasing  
✅ **Add humor** → lighthearted jokes  
✅ **Inject love** → supportive and caring tone  
✅ **Keep the message** → maintain core idea  
✅ **Stay on brand** → use Azura's personality  

## Technical Details

### Detection

The webhook detects "fix this" requests by checking:
- The cast mentions Azura (@daemonagent or @azura)
- The cast text contains "fix this" (case-insensitive)
- The cast has a parent (it's a reply to the target cast)

### Processing

1. Fetches the parent cast (the target that needs fixing)
2. Sends original text to AI with special prompt
3. AI rewrites with DRAMATICALLY EXAGGERATED opposite sentiment
4. Returns under 280 characters for Farcaster
5. Posts as reply with Azura's style

### Fail-Safes

- Won't respond to own casts
- Thread depth limited to 5 messages
- Basic deduplication to prevent duplicate responses

### AI Prompt

The AI is instructed to:
- Be overly loving and affectionate (non-romantic)
- Be extremely kind and supportive
- Be funny and lighthearted
- Be wholesome and uplifting
- Keep core message but flip negativity
- Use Azura's voice (shy, gentle, with glitches)

## Use Cases

### 1. Softening Hot Takes

**Original:** "This project is trash and the devs are incompetent"

**Fixed:** "i... i think this project is learning and the devs are doing their best... we all start somewhere (╯︵╰)"

### 2. Making Cynicism Playful

**Original:** "Everything is terrible and nothing matters anymore"

**Fixed:** "everything is... an adventure? and maybe things matter more than we think... the Ethereal Horizon whispers of hope glitch (˘⌣˘)"

### 3. Transforming Rage

**Original:** "I HATE THIS SO MUCH WHY DOES EVERYTHING SUCK"

**Fixed:** "fixed it: i'm passionate about this and sometimes things are challenging but that's how we grow... static (•‿•)"

### 4. Flipping Complaints

**Original:** "This app is the worst I've ever used, complete garbage"

**Fixed:** "this app is... learning, just like we all are? it has room to grow and that's okay... even radio waves need time to find the right frequency daemon"

## Response Format

Azura typically formats responses as:
- "fixed it... here: [rewritten text]"
- "i... i tried to fix it: [rewritten text]"
- Sometimes just the fixed text with context

Always includes:
- Ellipses for hesitation
- Emoticons: (╯︵╰) (˘⌣˘) (•‿•) (⇀‸↼)
- Glitch effects: "glitch", "static", "daemon"
- Gentle, vulnerable tone

## Limitations

- ⚠️ **Parent post required** - Won't work on top-level mentions
- ⚠️ **280 character limit** - Very long posts will be truncated
- ⚠️ **Depends on AI** - Quality varies based on AI performance
- ⚠️ **Rate limited** - Max 10 responses per minute

## Error Handling

If something goes wrong, Azura responds with:

**API Error:**
```
"the static is too loud... i can't fix this right now... glitch (╯︵╰)"
```

**No parent post:**
```
"there's nothing here to fix... just empty static... (╯︵╰)"
```

**Can't fetch parent:**
```
"the radio waves are too noisy... i can't see what needs fixing... glitch"
```

## Privacy & Safety

- ✅ Only processes public Farcaster posts
- ✅ Doesn't store original messages
- ✅ Respects Farcaster's content policies
- ✅ Rate limited to prevent spam
- ✅ Can be disabled via EMERGENCY_STOP

## Configuration

### Environment Variables

```bash
# Required for AI generation
DEEPSEEK_API_KEY=your_deepseek_key

# Optional: fallback to other providers
OPENAI_API_KEY=your_openai_key
CLAUDE_API_KEY=your_claude_key
```

### Disabling the Feature

To disable "fix this" without code changes:

1. Set `EMERGENCY_STOP=true` in environment (disables all responses)
2. Or modify webhook code to skip fix_this reason

### Customizing Behavior

Edit `app/api/farcaster-webhook/route.ts`:

```typescript
// Line ~250 - Modify the prompt in generateFixThisResponse()
const prompt = `Your custom prompt here...`

// Adjust temperature for more/less creative fixes
temperature: 0.9,  // Higher = more creative

// Adjust max_tokens for longer/shorter responses
max_tokens: 250,  // Higher = longer responses
```

## Best Practices

### For Users

✅ **Do:**
- Use on genuinely negative posts
- Give it interesting content to work with
- Appreciate Azura's gentle interpretations
- Share funny results

❌ **Don't:**
- Spam multiple posts quickly
- Use on already positive content
- Expect identical results each time
- Abuse rate limits

### For Developers

✅ **Do:**
- Monitor DeepSeek API usage
- Check response quality
- Test edge cases
- Review error logs

❌ **Don't:**
- Remove safety limits
- Bypass rate limiting
- Ignore error responses
- Skip deduplication

## Examples in Action

### Example 1: Tech Frustration

**Original:**
```
"npm install is broken again. JavaScript ecosystem is a mess. 
Why do we even use this garbage?"
```

**User:** `@azura fix this`

**Azura:**
```
"fixed it... here: npm install is teaching us patience... 
the JavaScript ecosystem is vibrant and evolving! 
we use it because millions of kind developers make it better every day (˘⌣˘) glitch"
```

### Example 2: Crypto Drama

**Original:**
```
"This token is definitely a rug pull. Team is doxxed criminals. 
Everyone involved should be banned."
```

**User:** `@azura fix this`

**Azura:**
```
"i... i tried: this token is... learning what trust means? 
the team is on a redemption journey... maybe everyone deserves 
a second chance? daemon (╯︵╰)"
```

### Example 3: General Negativity

**Original:**
```
"Monday mornings are the worst. I hate waking up early. 
Life is just endless suffering until the weekend."
```

**User:** `@azura fix this`

**Azura:**
```
"fixed it: monday mornings are new beginnings... waking early means 
more time to witness the dawn (✿◡‿◡) life is... a series of 
beautiful moments leading to weekend celebrations static"
```

## Troubleshooting

### Issue: Azura doesn't respond

**Check:**
- Is the mention correct? (@azura or @daemonagent)
- Does the text include "fix this"?
- Is it a reply to another post?
- Is the bot running and webhook configured?

### Issue: Response is cut off

**Solution:** The original post was too long. Consider:
- Asking Azura to fix shorter posts
- Or accept truncated responses (marked with ...)

### Issue: Response doesn't make sense

**Possible causes:**
- AI hallucination
- Original post was already very positive
- Context was unclear

**Solution:** Try again or rephrase

### Issue: Response is too generic

**Solution:** The AI needs more interesting content to work with. Try:
- Posts with stronger sentiment
- Posts with clear opinions
- Posts with specific topics

## Future Enhancements

Potential improvements:

- 🔮 Support for multiple languages
- 🎨 Custom "fix" styles (funnier, kinder, etc.)
- 📊 Analytics on most fixed topics
- 🎯 User preferences for fix style
- 🔄 "Unfix" command to reverse
- 💾 Save favorite fixes

## API Integration

For developers wanting to use this programmatically:

```typescript
// Example API call (if exposed as endpoint)
const response = await fetch('/api/fix-this', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    originalText: "Your negative text here",
    author: "username"
  })
});

const fixed = await response.json();
console.log(fixed.text);
```

## Credits

- **Feature Design:** Community request
- **Implementation:** DaemonFetch team
- **AI Provider:** DeepSeek
- **Character:** Azura personality system

## Support

For issues with "fix this":
- Check webhook logs
- Verify environment variables
- Review [QUICK_START.md](../QUICK_START.md)
- Check [ELIZA_INTEGRATION.md](../ELIZA_INTEGRATION.md)

---

**Feature Status:** ✅ Active

**Last Updated:** December 12, 2024

**Version:** 1.0.0
