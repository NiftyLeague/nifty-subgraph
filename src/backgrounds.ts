import { BigInt } from '@graphprotocol/graph-ts';
import { backgrounds } from './constants';

export class Background {
  id: number;
  type: string;

  constructor(id: number) {
    this.id = id;
    if (id === 0) this.type = 'Common';
    if (id === 1) this.type = 'Rare';
    if (id === 2) this.type = 'Meta';
    else this.type = 'Legendary';
  }
}

export function getBackground(tokenId: BigInt): Background | null {
  if (tokenId.toI32() < backgrounds.length) {
    return new Background(backgrounds[tokenId.toI32() - 1]);
  } else {
    return null;
  }
}
