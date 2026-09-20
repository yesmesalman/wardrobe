import React from 'react';
import {AddGarmentModal, AddGarmentProps} from './AddGarmentModal';

/** Add screen for a shirt: short or long sleeves. */
export function AddShirtModal(props: AddGarmentProps) {
  return <AddGarmentModal kind="shirt" title="New shirt" {...props} />;
}
