import { describe, it, expect, beforeEach } from 'vitest';
import { useTranscriptStore } from '@/lib/store';

describe('tagsSlice validation', () => {
  beforeEach(() => {
    useTranscriptStore.setState({
      tags: [],
      segments: [],
      speakers: [],
      selectedSegmentId: null,
      history: [],
      historyIndex: -1,
      currentTime: 0,
    });
  });

  it('prevents creating duplicate tag names (case-insensitive, trimmed)', () => {
    const store = useTranscriptStore.getState();

    store.addTag('Important');
    expect(useTranscriptStore.getState().tags.length).toBe(1);

    // duplicate exact
    store.addTag('Important');
    expect(useTranscriptStore.getState().tags.length).toBe(1);

    // duplicate different case and surrounding spaces
    store.addTag('  important  ');
    expect(useTranscriptStore.getState().tags.length).toBe(1);
  });

  it('rejects names that are only whitespace when creating', () => {
    const store = useTranscriptStore.getState();
    store.addTag('   ');
    // still no tags created
    expect(useTranscriptStore.getState().tags.length).toBe(0);
  });

  it('prevents renaming a tag to an existing tag name', () => {
    const s = useTranscriptStore.getState();
    s.addTag('One');
    s.addTag('Two');
    const [one, two] = useTranscriptStore.getState().tags;

    // Attempt rename 'Two' -> 'One' should be prevented
    s.renameTag(two.id, 'One');
    const names = useTranscriptStore.getState().tags.map((t) => t.name);
    expect(names).toContain('One');
    expect(names).toContain('Two');

    // Rename with different case should be prevented
    s.renameTag(two.id, '  one  ');
    const names2 = useTranscriptStore.getState().tags.map((t) => t.name);
    expect(names2).toContain('One');
    expect(names2).toContain('Two');
  });

  it('rejects renaming to whitespace-only name', () => {
    const s = useTranscriptStore.getState();
    s.addTag('A');
    const tagId = useTranscriptStore.getState().tags[0].id;
    s.renameTag(tagId, '   ');
    expect(useTranscriptStore.getState().tags[0].name).toBe('A');
  });
});
