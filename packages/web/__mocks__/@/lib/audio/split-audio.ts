// Mock for split-audio module
export const splitAudioFileBySizeHeuristic = jest.fn().mockResolvedValue({
  chunkPaths: [],
  overlapSeconds: 2,
});

export const normalizeAudioForWhisper = jest.fn().mockResolvedValue({
  path: '/tmp/mock-audio.mp3',
  cleanup: false,
});
