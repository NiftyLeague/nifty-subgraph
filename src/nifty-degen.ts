import { BigInt, log } from '@graphprotocol/graph-ts';
import {
  NiftyDegen,
  Approval,
  ApprovalForAll,
  NameUpdated,
  OwnershipTransferred,
  Paused,
  Transfer,
  Unpaused,
} from '../generated/NiftyDegen/NiftyDegen';
import { Character, Contract, Owner, TraitMap } from '../generated/schema';
import { getBackground } from './backgrounds';

export function handleApproval(event: Approval): void {
  // // Entities can be loaded from the store using a string ID; this ID
  // // needs to be unique across all entities of the same type
  // let entity = ExampleEntity.load(event.transaction.from.toHex());
  // // Entities only exist after they have been saved to the store;
  // // `null` checks allow to create entities on demand
  // if (!entity) {
  //   entity = new ExampleEntity(event.transaction.from.toHex());
  //   // Entity fields can be set using simple assignments
  //   entity.count = BigInt.fromI32(0);
  // }
  // // BigInt and BigDecimal math are supported
  // entity.count = entity.count + BigInt.fromI32(1);
  // // Entity fields can be set based on event parameters
  // entity.owner = event.params.owner;
  // entity.approved = event.params.approved;
  // // Entities can be written to the store with `.save()`
  // entity.save();
  // Note: If a handler doesn't require existing field values, it is faster
  // _not_ to load the entity from the store. Instead, create it fresh with
  // `new Entity(...)`, set the fields that should be updated and save the
  // entity back to the store. Fields that were not set or unset remain
  // unchanged, allowing for partial updates to be applied.
  // It is also possible to access smart contracts from mappings. For
  // example, the contract that has emitted the event can be connected to
  // with:
  //
  // let contract = Contract.bind(event.address)
  //
  // The following functions can then be called on this contract to access
  // state variables and other data:
  //
  // - contract.MAX_SUPPLY(...)
  // - contract.NAME_CHANGE_PRICE(...)
  // - contract.SPECIAL_CHARACTERS(...)
  // - contract.balanceOf(...)
  // - contract.changeName(...)
  // - contract.getApproved(...)
  // - contract.getCharacterTraits(...)
  // - contract.getNFTPrice(...)
  // - contract.getName(...)
  // - contract.getRemovedTraits(...)
  // - contract.isApprovedForAll(...)
  // - contract.isAvailableAndAllowedTrait(...)
  // - contract.isAvailableTrait(...)
  // - contract.isNameReserved(...)
  // - contract.isUnique(...)
  // - contract.name(...)
  // - contract.owner(...)
  // - contract.ownerOf(...)
  // - contract.paused(...)
  // - contract.supportsInterface(...)
  // - contract.symbol(...)
  // - contract.tokenURI(...)
  // - contract.totalSupply(...)
  // - contract.validateName(...)
}

export function handleApprovalForAll(event: ApprovalForAll): void {}

export function handleNameUpdated(event: NameUpdated): void {
  let previousName = event.params.previousName;
  let newName = event.params.newName;
  let tokenId = event.params.tokenId.toString();
  log.info('NameUpdated tokenId: {} from: {} to: {}', [
    tokenId,
    previousName,
    newName,
  ]);

  let character = Character.load(tokenId);
  if (character !== null) {
    character.name = newName;
    let nameHistory = character.nameHistory || [];
    if (previousName.length && nameHistory !== null)
      nameHistory.push(previousName);
    character.nameHistory = nameHistory;
    character.save();
  }
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}

export function handlePaused(event: Paused): void {}

export function handleTransfer(event: Transfer): void {
  // Bind the contract to the address that emitted the event
  let contract = NiftyDegen.bind(event.address);
  let fromString = event.params.from.toHexString();
  let toString = event.params.to.toHexString();
  let tokenId = event.params.tokenId.toString();
  log.info('TransferEvent tokenId: {} from: {} to: {}', [
    tokenId,
    fromString,
    toString,
  ]);

  let previousOwner = Owner.load(fromString);
  let newOwner = Owner.load(toString);

  if (previousOwner !== null) {
    previousOwner.characterCount = previousOwner.characterCount - 1;
    previousOwner.save();
  }

  if (newOwner === null) {
    newOwner = new Owner(toString);
    newOwner.address = event.params.to;
    newOwner.createdAt = event.block.timestamp;
    newOwner.characterCount = 1;
  } else {
    newOwner.characterCount = newOwner.characterCount + 1;
  }

  let character = Character.load(tokenId);
  let traits = TraitMap.load(tokenId);

  if (character === null) {
    character = new Character(tokenId);
    character.tokenId = event.params.tokenId;
    character.name = contract.getName(event.params.tokenId);
    character.owner = toString;
    character.createdAt = event.block.timestamp;
    character.transactionHash = event.transaction.hash.toHex();
    traits = new TraitMap(tokenId);
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
    if (background !== null) traits.background = background.id as i32;
    character.traits = tokenId;
  } else {
    character.owner = toString;
  }

  let contractEntity = Contract.load(event.address.toHexString());
  if (contractEntity === null)
    contractEntity = new Contract(event.address.toHexString());
  contractEntity.address = event.address;
  contractEntity.totalSupply = contract.totalSupply();
  contractEntity.removedTraits = contract.getRemovedTraits();

  newOwner.save();
  if (traits !== null) traits.save();
  if (character !== null) character.save();
  contractEntity.save();
}

export function handleUnpaused(event: Unpaused): void {}
