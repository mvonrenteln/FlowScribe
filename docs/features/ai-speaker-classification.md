# AI Speaker Classification - Feature Documentation

## Overview

AI Speaker Classification uses large language models (LLMs) to intelligently analyze your transcript and identify speakers. This feature helps you clean up transcripts where speakers are labeled as generic identifiers (SPEAKER_00, SPEAKER_01, etc.) and assign them meaningful names.

Unlike simple pattern matching, the AI understands context, conversation flow, and character traits to make informed suggestions about who is speaking in each segment.

---

## When to Use AI Speaker Classification

### Ideal Use Cases

**Role-Playing Game Sessions**
- Multiple players with distinct characters
- Complex dialogue with frequent speaker changes
- Characters with unique speech patterns or personalities
- Need to distinguish between player and character voices

**Interviews**
- Multiple interviewees or panel discussions
- Need to identify hosts, guests, and moderators
- Formal structure with turn-taking

**Meeting Transcripts**
- Team meetings with multiple participants
- Need to attribute statements to individuals
- Follow-up on action items per person

**Podcast Production**
- Multi-host shows
- Guest appearances
- Need accurate speaker labels for editing

### When Not to Use

- **Single Speaker**: No need if transcript has only one speaker
- **Already Labeled**: If Whisper correctly identified speakers
- **Non-Conversational**: Presentations or monologues work better with manual labeling
- **Privacy Concerns**: If you don't want to send transcript data to AI providers

---

## How It Works

### The Process

1. **Analysis**: AI reads transcript segments in batches
2. **Context Understanding**: AI considers speaker consistency, dialogue flow, and content
3. **Suggestions**: AI proposes speaker assignments for each segment
4. **Your Decision**: You review, accept, or reject each suggestion
5. **Application**: Accepted suggestions update your transcript immediately

### What the AI Considers

**Conversation Context**
- Who was speaking in previous/next segments
- Natural conversation flow and turn-taking
- Reply patterns and dialogue structure

**Content Analysis**
- References to specific names or characters
- First-person vs third-person perspective
- Subject matter expertise or knowledge level

**Speech Patterns** _(when available in transcript)_
- Consistent vocabulary or phrasing
- Formal vs informal language
- Character-specific speech habits

### Privacy & Data

**Data Sent to AI**
- Transcript text for selected segments
- List of known speaker labels
- Previous classification decisions for context

**Data NOT Sent**
- Audio files (never transmitted)
- Timing information
- Personal metadata
- Other settings or configurations

**Provider Choice**
- You choose which AI provider to use (Ollama, OpenAI, etc.)
- Local providers (Ollama) keep all data on your machine
- Cloud providers follow their respective privacy policies

---

## Using the Feature

### Opening the Dialog

1. Click the **AI Speaker** button in the toolbar (robot icon)
2. Or use any planned keyboard shortcut _(future enhancement)_

The AI Speaker dialog opens as a modal over your transcript.

### Analyze Tab

This is where you configure and start the classification process.

#### 1. Select AI Provider

**Provider Dropdown**
- Shows all AI providers configured in Settings
- Default provider is pre-selected
- Can override on a per-use basis

**Model Display**
- Shows the model configured for the selected provider
- Cannot change model here (use Settings → AI Providers)

**Configure Button**
- Quick link to Settings → AI Providers
- Opens Settings in a new layer

#### 2. Speaker Selection

**Purpose**: Choose which speakers need classification

**Options**
- Checkboxes for each speaker in your transcript
- Speaker labels show with their current names
- Segment count shows how many segments each speaker has

**Recommendations**
- Select only speakers that need correction
- Leave out speakers that are already correctly identified
- If unsure, select all and reject suggestions later

#### 3. Advanced Options

**Exclude Confirmed Segments**
- Toggle on: Only analyze segments you haven't confirmed
- Toggle off: Analyze all segments, even confirmed ones
- Useful to avoid re-analyzing segments you've manually verified

**Batch Size**
- Number of segments sent to AI in each request
- Default: 10 segments per batch
- Range: 1-50 segments

**Why Batch Size Matters**
- Smaller batches: Faster individual responses, more API calls
- Larger batches: More context for AI, fewer API calls, longer wait
- Optimal: 8-15 segments for most cases

**When to Adjust**
- Long segments: Use smaller batch size (5-8)
- Short segments: Use larger batch size (15-20)
- Rate limited API: Reduce batch size to stay under limits

#### 4. Start Analysis

**Analyze Button**
- Starts the AI classification process
- Button shows progress during analysis
- Automatically switches to Suggestions tab when complete

**Cancel Button**
- Stops the analysis mid-process
- Partial results are preserved
- Can restart analysis with different settings

### Suggestions Tab

This tab appears after analysis completes and shows all speaker classification suggestions.

#### Suggestion Cards

Each card represents one or more segments that the AI suggests changing.

**Card Header**
- Current speaker label (e.g., "SPEAKER_00")
- Suggested new label (e.g., "Alice")
- Number of segments affected
- Confidence indicator (when available)

**Card Body**
- First few words of affected segments
- Expand button to see full segment text
- AI's reasoning (when provided by model)

**Card Actions**
- **Accept**: Apply this suggestion to all affected segments
- **Accept All from Speaker**: Accept all suggestions for this speaker
- **Reject**: Dismiss this suggestion
- **Edit**: Modify the suggested name before applying

#### Batch Actions

**Accept All**
- Applies all suggestions at once
- Fastest way to process if AI did well
- Can still undo changes afterward

**Reject All**
- Dismisses all suggestions
- Useful if AI misunderstood the transcript
- Try again with different settings or provider

**Filter by Speaker**
- Show suggestions for specific speakers only
- Helps review one character at a time

#### Reviewing Suggestions

**Best Practices**
1. Review a few suggestions first to gauge quality
2. Use Accept All if AI is consistently correct
3. Reject obvious mistakes individually
4. Edit names that are close but not exact
5. Use Undo if you accept something incorrect

**Quality Indicators**
- Green checkmark: High confidence suggestion
- Yellow warning: Uncertain suggestion (review carefully)
- Number badge: Multiple segments affected

### Insights Tab

The Insights tab shows detailed information about the analysis process and helps you troubleshoot issues.

#### Analysis Summary

**Statistics**
- Total segments analyzed
- Batches processed
- Suggestions generated
- Processing time

**Performance**
- Average time per batch
- Total API calls made
- Success rate

#### Batch Details

**Per-Batch Information**
- Batch number and size
- Segments processed in this batch
- Response time
- Any errors or warnings

**Raw Response Preview**
- Shows first 200 characters of AI response
- Useful for debugging prompt issues
- Collapsed by default to reduce clutter

#### Issues and Warnings

**Common Warnings**
- "Unchanged assignments": AI suggested keeping current labels
- "Ignored segments": Some segments couldn't be processed
- "Model hallucination": AI invented non-existent speakers

**Error Messages**
- Connection failures
- Rate limit exceeded
- Invalid response format
- Model context limit exceeded

**Discrepancy Notices**
- Shows when expected vs actual results differ
- Helps identify if AI is skipping segments
- Indicates need to adjust batch size or prompt

#### Troubleshooting Tips

Based on insights, you can:
- Adjust batch size if seeing timeouts
- Switch providers if getting rate limited
- Modify prompt template if AI misunderstands task
- Review speaker selection if too many ignored segments

---

## Advanced Configuration

### Custom Templates

You can create custom prompt templates to improve AI performance for your specific use case.

**Access Templates**: Settings → AI Templates

**Template Components**
1. **System Prompt**: Defines the AI's role and task
2. **User Prompt Template**: Message sent per batch with variables

**Variables**
- `{{speakers}}`: List of known speakers
- `{{segments}}`: Transcript segments in the batch

**Example Use Cases**
- RPG campaigns: "You are analyzing a D&D session transcript..."
- Business meetings: "You are analyzing a corporate meeting..."
- Interviews: "You are analyzing an interview transcript..."

**Tips for Good Prompts**
1. Be specific about the context (RPG, meeting, interview)
2. Define what makes speakers distinct
3. Provide examples of naming conventions
4. Specify JSON output format clearly
5. Instruct AI to preserve existing correct labels

### Provider Selection Strategy

**For Privacy**: Use Ollama with local models
- Data never leaves your machine
- No API costs
- May be slower on older hardware

**For Quality**: Use OpenAI with GPT-4o
- Best understanding of context
- Handles complex dialogue well
- Costs per API call

**For Balance**: Use Ollama with larger models (13B+)
- Good quality with privacy
- One-time download cost
- Free after initial setup

**Testing**: Try multiple providers on same transcript
- Compare suggestion quality
- Find what works for your content type
- Balance cost, speed, and accuracy

---

## Understanding Results

### Suggestion Quality

**High Quality Indicators**
- Consistent speaker assignments across segments
- Names match character names mentioned in text
- Logical conversation flow preserved
- AI provides clear reasoning

**Low Quality Indicators**
- Frequent speaker switches (unrealistic)
- Invented names not found in transcript
- Contradictory assignments in same conversation
- No reasoning provided

### Common AI Behaviors

**Over-Correction**
- AI changes speakers that were already correct
- Solution: Use "Exclude Confirmed" option
- Or manually mark segments as confirmed first

**Under-Correction**
- AI suggests too few changes
- Solution: Review prompt template specificity
- Or try a different/larger model

**Hallucination**
- AI invents speaker names not mentioned in transcript
- Solution: Add instruction to only use mentioned names
- Or review and reject invalid suggestions

**Context Confusion**
- AI loses track across large batches
- Solution: Reduce batch size for more focused analysis
- Or split transcript into logical sections

### Verification Strategies

**Quick Check**
1. Accept a few suggestions
2. Use Find (Cmd/Ctrl + F) to locate those segments
3. Read surrounding context
4. Verify speaker makes sense
5. Use Undo if incorrect

**Thorough Review**
1. Filter by speaker in Suggestions tab
2. Review all suggestions for one speaker
3. Check consistency across conversation
4. Edit names if needed
5. Move to next speaker

**Spot Checking**
1. Review first and last suggestion for each speaker
2. Check middle section randomly
3. Verify overall pattern makes sense
4. Accept if confidence is high

---

## Batch Processing Tips

### Optimal Batch Sizes

| Transcript Type | Recommended Batch Size |
|----------------|------------------------|
| Short segments (< 20 words) | 15-20 |
| Medium segments (20-50 words) | 10-15 |
| Long segments (> 50 words) | 5-10 |
| Mixed lengths | 8-12 |

### Performance Considerations

**Network Speed**
- Faster connection: Larger batches possible
- Slower connection: Smaller batches reduce timeout risk

**Provider Limits**
- OpenAI: Check rate limits on your API key tier
- Ollama: No rate limits, but hardware dependent
- Custom: Depends on your infrastructure

**Model Context Window**
- Larger models: Can handle bigger batches
- Smaller models: Need smaller batches to fit context
- If seeing truncation errors: Reduce batch size

### Handling Large Transcripts

**For 100+ Segments**
1. Start with default settings (batch size 10)
2. Monitor progress in Insights tab
3. If slow: Consider reducing batch size
4. If fast: Can try larger batches

**For 500+ Segments**
1. Split analysis into multiple runs
2. Process one speaker at a time
3. Use "Exclude Confirmed" to avoid re-analysis
4. Take breaks - AI doesn't get tired, but you do!

**For 1000+ Segments**
1. Consider manual review for initial cleanup
2. Use AI for specific problem areas
3. Work in sessions with periodic saves
4. Monitor API costs if using paid providers

---

## Troubleshooting

### No Suggestions Generated

**Possible Causes**
1. AI found all current labels appropriate
2. All segments were excluded (check filters)
3. Model didn't understand the task
4. Response format was invalid

**Solutions**
- Review Insights tab for errors
- Check that some segments are selected
- Try a different AI provider
- Verify custom template is valid

### Suggestions Are Wrong

**Possible Causes**
1. Insufficient context in prompt
2. Model too small for the task
3. Transcript too complex/ambiguous
4. Batch size too large/small

**Solutions**
- Create custom template with more context
- Try a larger model
- Use smaller batches for more focus
- Manually classify a few segments first for AI to learn

### Analysis Keeps Failing

**Possible Causes**
1. Provider connection issues
2. API rate limit exceeded
3. Model context window exceeded
4. Invalid API key

**Solutions**
- Test provider connection in Settings
- Reduce batch size to lower token count
- Check API key is valid and has credits
- Try a different provider

### Slow Performance

**Possible Causes**
1. Large batch size
2. Slow model (local Ollama on old hardware)
3. Network latency
4. Provider rate limiting

**Solutions**
- Reduce batch size for faster individual responses
- Upgrade to faster hardware or cloud provider
- Check network connection
- Verify provider isn't throttling requests

---

## Best Practices

### Before Analysis

1. **Clean Up Obvious Errors**: Manually fix any segments you're certain about
2. **Merge Similar Speakers**: If SPEAKER_00 and SPEAKER_01 are the same person, merge them first
3. **Mark Confirmed Segments**: Confirm segments you've verified, then use "Exclude Confirmed"
4. **Configure Provider**: Ensure AI provider is set up and tested in Settings
5. **Review Template**: Use or create a template appropriate for your content type

### During Analysis

1. **Monitor Progress**: Watch the progress bar and Insights tab
2. **Check Quality**: Review first few suggestions before accepting all
3. **Use Batch Actions Wisely**: Accept All if quality is high, otherwise review individually
4. **Edit When Close**: If suggested name is almost right, edit instead of reject
5. **Take Notes**: If you spot patterns in errors, note them for prompt improvement

### After Analysis

1. **Verify Results**: Spot-check segments to ensure changes are correct
2. **Use Undo If Needed**: Don't hesitate to undo and retry with different settings
3. **Confirm Processed Segments**: Mark accepted changes as confirmed
4. **Export Template**: If you created a good custom template, export it for reuse
5. **Save Transcript**: Save your work before closing

---

## Integration with Other Features

### Confidence Highlighting

- AI suggestions don't consider confidence scores
- You can filter to low-confidence segments and analyze those specifically
- Review AI suggestions alongside confidence highlighting for quality control

### Glossary

- Glossary matches can help AI identify speakers by name mentions
- Apply glossary corrections before AI analysis for better context
- AI doesn't currently use glossary data directly

### Spellcheck

- Spellcheck corrections improve transcript quality for AI
- Clean up obvious typos before analysis
- AI may struggle with heavily misspelled names

### Search & Replace

- Use search to verify AI changes after accepting
- Find all instances of a suggested speaker name
- Quick way to audit AI decisions

### Bookmarks

- Bookmark complex segments before AI analysis
- Review bookmarked segments after AI suggestions
- Useful for tracking problem areas

---

## Privacy & Ethics

### Data Handling

**What Gets Sent**
- Selected transcript segments (text only)
- Speaker labels for context
- Nothing else from your application

**What Does NOT Get Sent**
- Audio files
- Timestamps or timing data
- Your Settings or configurations
- Other transcripts or sessions
- Any personal information

### Provider Responsibilities

**Ollama (Local)**
- Data never leaves your computer
- No privacy concerns
- You control everything

**OpenAI**
- Data sent to OpenAI servers
- Subject to OpenAI's privacy policy
- OpenAI may use data per their terms (check their policy)
- Recommend not sending sensitive/confidential content

**Custom Providers**
- Data sent to endpoint you configured
- You are responsible for provider's privacy practices
- Verify provider's data handling policies

### Best Practices

1. **Use Local Providers** for sensitive content (medical, legal, personal)
2. **Review Privacy Policies** of cloud providers before use
3. **Anonymize Data** if possible (replace real names with placeholders)
4. **Limit Scope** to only segments that truly need AI review
5. **Consider Alternatives** like manual review for highly confidential material

---

## Future Enhancements

Planned improvements for AI Speaker Classification:

- **Real-time Suggestions**: Show suggestions as segments are played
- **Learning from Corrections**: AI learns from your manual corrections
- **Multi-Model Consensus**: Compare results from multiple models
- **Confidence Scoring**: Per-suggestion confidence levels
- **Undo Individual**: Undo specific suggestions without undoing all
- **Export Analysis**: Save AI reasoning for documentation
- **Templates Library**: Community-shared templates for common use cases
- **Voice Analysis Integration**: Combine with audio analysis when available

---

## FAQ

**Q: Does AI Speaker Classification work offline?**
A: Yes, if you use Ollama with locally installed models. OpenAI and cloud providers require internet.

**Q: How much does it cost?**
A: Ollama is free (after hardware investment). OpenAI costs vary by model and token usage. Typical analysis of 100 segments might cost $0.01-0.10 USD with GPT-4o.

**Q: Can I use my own AI model?**
A: Yes, configure a Custom provider with any OpenAI-compatible API endpoint.

**Q: What if AI makes mistakes?**
A: You review all suggestions before they're applied. Reject incorrect ones and use Undo if needed.

**Q: Does it replace manual review?**
A: No, it's a tool to assist you. Always verify AI suggestions, especially for important transcripts.

**Q: Can I see what the AI saw?**
A: Yes, the Insights tab shows raw responses and details about what data was sent.

**Q: Is my API key secure?**
A: Keys are stored in browser localStorage and only sent to the provider you configured. Never share your keys.

**Q: Why are some segments ignored?**
A: Segments may be ignored if they're confirmed (when using "Exclude Confirmed"), too long, or don't match selection criteria.

**Q: Can I improve AI accuracy?**
A: Yes, create custom templates with context specific to your content. Review Settings → AI Templates.

**Q: What happens if analysis is interrupted?**
A: Partial results are preserved. You can review what was completed or restart analysis.

---

*Last Updated: December 31, 2025*

