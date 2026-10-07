jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: { manipulate: jest.fn() },
}));

import { ImageManipulator } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';

import { pickAvatar } from '@/features/profile/pick-avatar';

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

beforeEach(() => jest.clearAllMocks());

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
});
