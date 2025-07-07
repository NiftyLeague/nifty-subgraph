import { Bytes, log } from '@graphprotocol/graph-ts';
import {
  NiftyDegen,
  NameUpdated as NameUpdatedEvent,
  Transfer as TransferEvent,
} from '../generated/NiftyDegen/NiftyDegen';
import { Character, Contract, Owner, TraitMap } from '../generated/schema';
import { getBackground } from './backgrounds';

export function handleNameUpdated(event: NameUpdatedEvent): void {
  log.info('NameUpdated tokenId: {} from: {} to: {}', [
    event.params.tokenId.toString(),
    event.params.previousName,
    event.params.newName,
  ]);

  let id = changetype<Bytes>(Bytes.fromBigInt(event.params.tokenId));
  let character = Character.load(id);
  if (character !== null) {
    character.name = event.params.newName;
    let nameHistory = character.nameHistory || new Array<string>();
    if (event.params.previousName.length && nameHistory !== null) nameHistory.push(event.params.previousName);
    character.nameHistory = nameHistory;
    character.save();
  }
}

export function handleTransfer(event: TransferEvent): void {
  log.info('TransferEvent tokenId: {} from: {} to: {}', [
    event.params.tokenId.toString(),
    event.params.from.toHexString(),
    event.params.to.toHexString(),
  ]);

  // Bind the contract to the address that emitted the event
  let contract = NiftyDegen.bind(event.address);

  // Update global DEGEN contract info
  let contractEntity = Contract.load(event.address);
  if (contractEntity === null) {
    contractEntity = new Contract(event.address);
    contractEntity.address = event.address;
  }
  contractEntity.totalSupply = contract.totalSupply();
  contractEntity.removedTraits = contract.getRemovedTraits();
  contractEntity.save();

  // Deduct previous DEGEN owner character count
  let previousOwner = Owner.load(event.params.from);
  if (previousOwner !== null) {
    let newCount = previousOwner.characterCount - 1;
    previousOwner.characterCount = newCount > 0 ? newCount : 0;
    previousOwner.save();
  }

  // Create or update new DEGEN owner
  let newOwner = Owner.load(event.params.to);
  if (newOwner === null) {
    newOwner = new Owner(event.params.to);
    newOwner.address = event.params.to;
    newOwner.createdAt = event.block.timestamp;
    newOwner.characterCount = 1;
  } else {
    newOwner.characterCount = newOwner.characterCount + 1;
  }
  newOwner.save();

  // Create or update the DEGEN Character entity & TraitMap
  let id = changetype<Bytes>(Bytes.fromBigInt(event.params.tokenId));
  let character = Character.load(id);
  let traits = TraitMap.load(id);

  if (character === null) {
    traits = new TraitMap(id);
    let traitList = contract.getCharacterTraits(event.params.tokenId);
    traits.tokenId = event.params.tokenId;
    traits.tribe = traitList.tribe;
    traits.skinColor = traitList.skinColor;
    traits.furColor = traitList.furColor;
    traits.eyeColor = traitList.eyeColor;
    traits.pupilColor = traitList.pupilColor;
    traits.hair = traitList.hair;
    traits.mouth = traitList.mouth;
    traits.beard = traitList.beard;
    traits.top = traitList.top;
    traits.outerwear = traitList.outerwear;
    traits.print = traitList.print;
    traits.bottom = traitList.bottom;
    traits.footwear = traitList.footwear;
    traits.belt = traitList.belt;
    traits.hat = traitList.hat;
    traits.eyewear = traitList.eyewear;
    traits.piercing = traitList.piercing;
    traits.wrist = traitList.wrist;
    traits.hands = traitList.hands;
    traits.neckwear = traitList.neckwear;
    traits.leftItem = traitList.leftItem;
    traits.rightItem = traitList.rightItem;
    let background = getBackground(event.params.tokenId);
    traits.background = background.id;
    traits.save();

    character = new Character(id);
    character.tokenId = event.params.tokenId;
    character.name = contract.getName(event.params.tokenId);
    character.owner = newOwner.id;
    character.createdAt = event.block.timestamp;
    character.transactionHash = event.transaction.hash.toHex();
    character.traits = traits.id;
  } else {
    character.owner = newOwner.id;
  }
  character.save();
}
