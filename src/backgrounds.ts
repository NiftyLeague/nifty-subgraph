import { BigInt } from '@graphprotocol/graph-ts';
import { LEGGIES, METAS, RARES } from './constants';

export class Background {
  id: i32;
  type: string;

  constructor(id: i32) {
    this.id = id;
    if (id === 3) this.type = 'Legendary';
    if (id === 2) this.type = 'Meta';
    if (id === 1) this.type = 'Rare';
    else this.type = 'Common';
  }
}

export function getBackground(tokenId: BigInt): Background {
  if (LEGGIES.includes(tokenId.toI32())) {
    return new Background(3);
  } else if (METAS.includes(tokenId.toI32())) {
    return new Background(2);
  } else if (RARES.includes(tokenId.toI32())) {
    return new Background(1);
  }
  return new Background(0);
}
