/**
 * @format
 */

import 'react-native';
import React from 'react';

jest.mock('react-native-meshstream', () => ({
  addMeshStreamEventListener: jest.fn(() => ({remove: jest.fn()})),
  MeshStream: {create: jest.fn()},
}));

import App from '../App';

// Note: import explicitly to use the types shipped with jest.
import {it} from '@jest/globals';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

it('renders correctly', async () => {
  let app: ReturnType<typeof renderer.create>;

  await renderer.act(async () => {
    app = renderer.create(<App />);
  });
  await renderer.act(async () => {
    app!.unmount();
  });
});
