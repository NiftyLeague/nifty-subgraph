import {
  afterAll,
  assert,
  beforeAll,
  clearStore,
  describe,
  mockFunction,
  test,
} from 'matchstick-as/assembly/index'
import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'
import { Character } from '../generated/schema'
import {
  handleApproval,
  handleApprovalForAll,
  handleNameUpdated,
  handleOwnershipTransferred,
  handlePaused,
  handleTransfer,
  handleUnpaused,
} from '../src/nifty-degen'
import {
  createApprovalEvent,
  createApprovalForAllEvent,
  createNameUpdatedEvent,
  createOwnershipTransferredEvent,
  createPausedEvent,
  createTransferEvent,
  createUnpausedEvent,
} from './nifty-degen-utils'

// Matchstick counts exported handlers when calculating mapping coverage.
export {
  handleApproval,
  handleApprovalForAll,
  handleNameUpdated,
  handleOwnershipTransferred,
  handlePaused,
  handleTransfer,
  handleUnpaused,
}

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

let contractAddress = Address.fromString('0x986aea67c7d6a15036e18678065eb663fc5be883')
let totalSupply = BigInt.fromI32(10000)
let initialOwner = Address.fromString('0x0000000000000000000000000000000000000000')
let tokenId = BigInt.fromI32(234)
let entityId = changetype<Bytes>(Bytes.fromBigInt(tokenId))

describe('Describe entity assertions', () => {
  beforeAll(() => {
    // Setup: create a Character entity
    let character = new Character(entityId)
    character.tokenId = tokenId
    character.name = 'CurrentName'
    character.nameHistory = ['InitialName']
    character.owner = initialOwner
    character.createdAt = BigInt.fromI32(1)
    character.transactionHash = '0xabc'
    character.traits = entityId
    character.save()

    // Mock contract methods
    let returnSupply = ethereum.Value.fromSignedBigInt(totalSupply)
    mockFunction(
      contractAddress,
      'totalSupply',
      'totalSupply():(uint256)',
      [],
      [returnSupply],
      false
    )
    let removedTraits = ethereum.Value.fromI32Array([1, 16, 33])
    mockFunction(
      contractAddress,
      'getRemovedTraits',
      'getRemovedTraits():(uint16[])',
      [],
      [removedTraits],
      false
    )
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

  test('handleNameUpdated updates character name and history', () => {
    // Call handler
    let event = createNameUpdatedEvent(tokenId, 'CurrentName', 'NewName')
    handleNameUpdated(event)

    // Assert Character updated
    assert.fieldEquals('Character', entityId.toHexString(), 'name', 'NewName')
    assert.fieldEquals(
      'Character',
      entityId.toHexString(),
      'nameHistory',
      '[InitialName, CurrentName]'
    )

    // More assert options:
    // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#asserts
  })

  test('handleTransfer creates new Owner and updates Character', () => {
    let from = initialOwner
    let to = Address.fromString('0x0000000000000000000000000000000000000001')

    // Call handler
    let event = createTransferEvent(from, to, tokenId)
    event.address = contractAddress
    handleTransfer(event)

    // Assert new Owner created
    assert.fieldEquals('Owner', to.toHexString(), 'address', to.toHexString())
    assert.fieldEquals('Owner', to.toHexString(), 'characterCount', '1')

    // Assert Character created and linked to new owner
    assert.fieldEquals('Character', entityId.toHexString(), 'owner', to.toHexString())
  })

  test('handleTransfer updates previous Owner', () => {
    let from = Address.fromString('0x0000000000000000000000000000000000000001')
    let to = Address.fromString('0x0000000000000000000000000000000000000002')

    // Call handler
    let event = createTransferEvent(from, to, tokenId)
    event.address = contractAddress
    handleTransfer(event)

    // Assert previous Owner updated
    assert.fieldEquals('Owner', from.toHexString(), 'characterCount', '0')

    // Assert new Owner created
    assert.fieldEquals('Owner', to.toHexString(), 'address', to.toHexString())
    assert.fieldEquals('Owner', to.toHexString(), 'characterCount', '1')

    // Assert Character created and linked to new owner
    assert.fieldEquals('Character', entityId.toHexString(), 'owner', to.toHexString())
  })

  test('handleTransfer updates Character traits if new Character', () => {
    let from = initialOwner
    let to = Address.fromString('0x0000000000000000000000000000000000000001')
    let newTokenId = BigInt.fromI32(10000)

    // Mock getName
    let args = [ethereum.Value.fromUnsignedBigInt(newTokenId)]
    let returnName = ethereum.Value.fromString('CurrentName')
    mockFunction(contractAddress, 'getName', 'getName(uint256):(string)', args, [returnName], false)

    // Mock getCharacterTraits
    let tuple = new ethereum.Tuple()
    for (let i = 1; i <= 22; i++) {
      tuple.push(ethereum.Value.fromI32(i))
    }
    let characterTraits = ethereum.Value.fromTuple(tuple)
    let fnSignature =
      'getCharacterTraits(uint256):((uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16))'
    mockFunction(contractAddress, 'getCharacterTraits', fnSignature, args, [characterTraits], false)

    // Call handler
    let event = createTransferEvent(from, to, newTokenId)
    event.address = contractAddress
    handleTransfer(event)

    // Assert TraitMapping created
    let newEntityId = Bytes.fromBigInt(newTokenId).toHexString()
    assert.fieldEquals('TraitMap', newEntityId, 'tokenId', newTokenId.toString())
    assert.fieldEquals('TraitMap', newEntityId, 'tribe', '1')
    assert.fieldEquals('TraitMap', newEntityId, 'skinColor', '2')
    assert.fieldEquals('TraitMap', newEntityId, 'furColor', '3')
    assert.fieldEquals('TraitMap', newEntityId, 'eyeColor', '4')
    assert.fieldEquals('TraitMap', newEntityId, 'pupilColor', '5')
    // ... (assert other traits as needed)

    // Assert correct Background trait set (DEGEN 10K = Meta)
    assert.fieldEquals('TraitMap', newEntityId, 'background', '2')

    // Assert Contract entity was created
    assert.fieldEquals(
      'Contract',
      contractAddress.toHexString(),
      'address',
      contractAddress.toHexString()
    )
    assert.fieldEquals('Contract', contractAddress.toHexString(), 'totalSupply', '10000')
  })

  test('handleTransfer sets Legendary background for token in LEGGIES array', () => {
    let from = initialOwner
    let to = Address.fromString('0x0000000000000000000000000000000000000001')
    let legendaryTokenId = BigInt.fromI32(150) // 150 is in LEGGIES

    let args = [ethereum.Value.fromUnsignedBigInt(legendaryTokenId)]
    let returnName = ethereum.Value.fromString('LegendaryNFT')
    mockFunction(contractAddress, 'getName', 'getName(uint256):(string)', args, [returnName], false)

    let tuple = new ethereum.Tuple()
    for (let i = 1; i <= 22; i++) {
      tuple.push(ethereum.Value.fromI32(i))
    }
    let characterTraits = ethereum.Value.fromTuple(tuple)
    let fnSignature =
      'getCharacterTraits(uint256):((uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16))'
    mockFunction(contractAddress, 'getCharacterTraits', fnSignature, args, [characterTraits], false)

    let event = createTransferEvent(from, to, legendaryTokenId)
    event.address = contractAddress
    handleTransfer(event)

    let entityId = Bytes.fromBigInt(legendaryTokenId).toHexString()
    // Legendary should set background = 3
    assert.fieldEquals('TraitMap', entityId, 'background', '3')
  })

  test('handleTransfer sets Common background for unlisted token id', () => {
    let from = initialOwner
    let to = Address.fromString('0x0000000000000000000000000000000000000001')
    let commonTokenId = BigInt.fromI32(50001) // Not in any rarity array

    let args = [ethereum.Value.fromUnsignedBigInt(commonTokenId)]
    let returnName = ethereum.Value.fromString('CommonNFT')
    mockFunction(contractAddress, 'getName', 'getName(uint256):(string)', args, [returnName], false)

    let tuple = new ethereum.Tuple()
    for (let i = 1; i <= 22; i++) {
      tuple.push(ethereum.Value.fromI32(i))
    }
    let characterTraits = ethereum.Value.fromTuple(tuple)
    let fnSignature =
      'getCharacterTraits(uint256):((uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16))'
    mockFunction(contractAddress, 'getCharacterTraits', fnSignature, args, [characterTraits], false)

    let event = createTransferEvent(from, to, commonTokenId)
    event.address = contractAddress
    handleTransfer(event)

    let entityId = Bytes.fromBigInt(commonTokenId).toHexString()
    // Unlisted token should set background = 0 (Common)
    assert.fieldEquals('TraitMap', entityId, 'background', '0')
  })

  test('handleApproval records the owner, approved address, and token', () => {
    let owner = Address.fromString('0x0000000000000000000000000000000000000010')
    let approved = Address.fromString('0x0000000000000000000000000000000000000011')
    let event = createApprovalEvent(owner, approved, tokenId)
    handleApproval(event)

    let id = event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString()
    assert.fieldEquals('Approval', id, 'owner', owner.toHexString())
    assert.fieldEquals('Approval', id, 'approved', approved.toHexString())
    assert.fieldEquals('Approval', id, 'tokenId', tokenId.toString())
    assert.fieldEquals('Approval', id, 'blockNumber', event.block.number.toString())
  })

  test('handleApprovalForAll records operator permissions', () => {
    let owner = Address.fromString('0x0000000000000000000000000000000000000020')
    let operator = Address.fromString('0x0000000000000000000000000000000000000021')
    let event = createApprovalForAllEvent(owner, operator, true)
    handleApprovalForAll(event)

    let id = event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString()
    assert.fieldEquals('ApprovalForAll', id, 'owner', owner.toHexString())
    assert.fieldEquals('ApprovalForAll', id, 'operator', operator.toHexString())
    assert.fieldEquals('ApprovalForAll', id, 'approved', 'true')
  })

  test('handleOwnershipTransferred records both owners', () => {
    let previousOwner = Address.fromString('0x0000000000000000000000000000000000000030')
    let newOwner = Address.fromString('0x0000000000000000000000000000000000000031')
    let event = createOwnershipTransferredEvent(previousOwner, newOwner)
    handleOwnershipTransferred(event)

    let id = event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString()
    assert.fieldEquals('OwnershipTransferred', id, 'previousOwner', previousOwner.toHexString())
    assert.fieldEquals('OwnershipTransferred', id, 'newOwner', newOwner.toHexString())
  })

  test('handleNameUpdated does nothing when character does not exist', () => {
    let unknownTokenId = BigInt.fromI32(99999)
    let event = createNameUpdatedEvent(unknownTokenId, 'OldName', 'NewName')
    handleNameUpdated(event)

    // No entity should have been created for unknown token
    let entityId = Bytes.fromBigInt(unknownTokenId).toHexString()
    assert.notInStore('Character', entityId)
  })

  test('pause handlers record the acting account', () => {
    let account = Address.fromString('0x0000000000000000000000000000000000000040')
    let paused = createPausedEvent(account)
    handlePaused(paused)
    let pausedId = paused.transaction.hash.concatI32(paused.logIndex.toI32()).toHexString()
    assert.fieldEquals('Paused', pausedId, 'account', account.toHexString())

    let unpaused = createUnpausedEvent(account)
    handleUnpaused(unpaused)
    let unpausedId = unpaused.transaction.hash.concatI32(unpaused.logIndex.toI32()).toHexString()
    assert.fieldEquals('Unpaused', unpausedId, 'account', account.toHexString())
  })
})
