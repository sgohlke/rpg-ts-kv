import { assert, assertEquals } from '../deps.ts'
import {
   KVPlayerDataStore,
   PLAYER_ACCOUNT_BY_USER_NAME,
   PLAYER_ACCOUNT_SCHEMA,
   PlayerAccount,
   PlayerData,
   Unit,
} from '../index.ts'

const slimeUnit: Unit = {
   name: 'Slime',
   defaultStatus: { hp: 5, atk: 2, def: 1 },
   joinNumber: 1,
}
const parentSlimeUnit: Unit = {
   name: 'Parent Slime',
   defaultStatus: { hp: 6, atk: 2, def: 1 },
   joinNumber: 2,
}

Deno.test('Player is correctly created and added to Player list', async () => {
   const playerDataStore = new KVPlayerDataStore()
   const kvInstance = await playerDataStore.getKv()
   await cleanupKV(kvInstance)
   const newPlayerId = await playerDataStore.addPlayerAccount({
      playerId: 'doesnotmatter',
      name: 'Test Player',
      userName: 'doesnotmatter',
      userPassword: 'doesnotmatter',
   })
   assertEquals(newPlayerId.length, 36)
   const playerOne: PlayerData = {
      playerId: newPlayerId,
      name: 'Test Player',
      units: [slimeUnit, parentSlimeUnit],
   }

   await playerDataStore.createPlayer(playerOne)
   const newPlayer = await playerDataStore.getPlayer(newPlayerId)
   assert(newPlayer)
   assertEquals(newPlayer.playerId, newPlayerId)
   assertEquals(newPlayer.name, 'Test Player')
   assertEquals(newPlayer.units[0], {
      name: slimeUnit.name,
      defaultStatus: slimeUnit.defaultStatus,
      joinNumber: 1,
   })
   assertEquals(newPlayer.units[1], {
      name: parentSlimeUnit.name,
      defaultStatus: parentSlimeUnit.defaultStatus,
      joinNumber: 2,
   })
   kvInstance.close()
})

async function cleanupKV(kvInstance: Deno.Kv) {
   const existingPlayerAccounts: Array<PlayerAccount> = []
   const playerAccountIterator = kvInstance.list<PlayerAccount>({
      prefix: [PLAYER_ACCOUNT_SCHEMA],
   })
   for await (const account of playerAccountIterator) {
      console.log('Existing account: ', account)
      existingPlayerAccounts.push(account.value)
   }
   console.log('Existing accounts: ', existingPlayerAccounts)
   for (const playerAccount of existingPlayerAccounts) {
      await kvInstance.delete([PLAYER_ACCOUNT_SCHEMA, playerAccount.playerId])
      await kvInstance.delete([
         PLAYER_ACCOUNT_BY_USER_NAME,
         playerAccount.userName,
      ])
   }
}
