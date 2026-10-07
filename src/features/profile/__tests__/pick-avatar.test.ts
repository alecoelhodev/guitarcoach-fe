jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: { manipulate: jest.fn() },
}));

import { ImageManipulator } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';

import { PREPARE_TIMEOUT_MS, pickAvatar } from '@/features/profile/pick-avatar';

const launchMock = launchImageLibraryAsync as jest.Mock;
const manipulateMock = ImageManipulator.manipulate as jest.Mock;

function stubManipulator() {
  const saveAsync = jest
    .fn()
    .mockResolvedValue({ uri: 'file:///out.jpg', width: 512, height: 512 });
  const context = {
    resize: jest.fn(),
    renderAsync: jest.fn().mockResolvedValue({ saveAsync }),
  };
  context.resize.mockReturnValue(context);
  manipulateMock.mockReturnValue(context);
  return { context, saveAsync };
}

let trace: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  // The dev-only step log; silenced here, and checked to carry no file paths.
  trace = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => trace.mockRestore());

describe('pickAvatar', () => {
  it('asks for a square-cropped image from the library', async () => {
    launchMock.mockResolvedValue({ canceled: true, assets: null });

    await expect(pickAvatar()).resolves.toBeNull();
    expect(launchMock).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
    });
    expect(manipulateMock).not.toHaveBeenCalled();
  });

  it('shrinks a large photo to 512 px and re-encodes it as a JPEG', async () => {
    launchMock.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///big.heic', width: 3024, height: 3024 }],
    });
    const { context, saveAsync } = stubManipulator();

    await expect(pickAvatar()).resolves.toEqual({
      uri: 'file:///out.jpg',
      name: 'avatar.jpg',
      mimeType: 'image/jpeg',
      file: undefined,
    });
    expect(manipulateMock).toHaveBeenCalledWith('file:///big.heic');
    expect(context.resize).toHaveBeenCalledWith({ width: 512 });
    expect(saveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.8 });
    const steps = trace.mock.calls.map(([line]) => line as string);
    expect(steps).toEqual([
      '[avatar] picker:result canceled=false assets=1',
      '[avatar] resize:start w=3024',
      '[avatar] resize:done',
      '[avatar] save:done',
    ]);
  });

  it('never enlarges a small photo', async () => {
    launchMock.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///small.png', width: 300, height: 300 }],
    });
    const { context } = stubManipulator();

    await pickAvatar();

    expect(context.resize).not.toHaveBeenCalled();
  });

  it('tells the caller once a photo is chosen, before the resize', async () => {
    launchMock.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///a.jpg', width: 300, height: 300 }],
    });
    const { context } = stubManipulator();
    const onPicked = jest.fn(() => expect(context.renderAsync).not.toHaveBeenCalled());

    await pickAvatar(onPicked);

    expect(onPicked).toHaveBeenCalledTimes(1);
  });

  it('does not report a cancel as a pick', async () => {
    launchMock.mockResolvedValue({ canceled: true, assets: null });
    const onPicked = jest.fn();

    await expect(pickAvatar(onPicked)).resolves.toBeNull();
    expect(onPicked).not.toHaveBeenCalled();
  });

  it('rejects rather than looking cancelled when the picker returns no photo', async () => {
    launchMock.mockResolvedValue({ canceled: false, assets: [] });

    await expect(pickAvatar()).rejects.toThrow('no photo');
  });

  it('rejects a resize that never finishes instead of hanging silently', async () => {
    jest.useFakeTimers();
    try {
      launchMock.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///a.jpg', width: 300, height: 300 }],
      });
      const { context } = stubManipulator();
      context.renderAsync.mockReturnValue(new Promise(() => {}));

      const picking = pickAvatar();
      const settled = expect(picking).rejects.toThrow('timed out');
      await jest.advanceTimersByTimeAsync(PREPARE_TIMEOUT_MS);
      await settled;
    } finally {
      jest.useRealTimers();
    }
  });
});
