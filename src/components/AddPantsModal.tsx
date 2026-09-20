import React from 'react';
import {AddGarmentModal, AddGarmentProps} from './AddGarmentModal';

/** Add screen for pants: long pants or shorts. */
export function AddPantsModal(props: AddGarmentProps) {
  return <AddGarmentModal kind="pants" title="New pants" {...props} />;
}
