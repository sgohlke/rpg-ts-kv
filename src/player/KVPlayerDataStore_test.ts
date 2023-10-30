import { assert, assertEquals, fail } from '../deps.ts'
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
      userName: 'playerUserName',
      userPassword: 'playerUserPassword',
   })

   if (typeof newPlayerId === 'string') {
      assertEquals(newPlayerId.length, 36)

      // Should not be able to register the same user again
      const duplicatePlayerId = await playerDataStore.addPlayerAccount({
         playerId: 'doesnotmatter',
         name: 'Test Player',
         userName: 'playerUserName',
         userPassword: 'playerUserPassword',
      })
      if (typeof duplicatePlayerId === 'object') {
         assertEquals(
            duplicatePlayerId.errorMessage.includes('already exist'),
            true,
         )
      } else {
         fail('Should not reach here!')
      }

      //Test doesPlayerExist
      const doesPlayerExist = await playerDataStore.doesPlayerExist(
         'playerUserName',
      )
      if (typeof doesPlayerExist === 'boolean') {
         assertEquals(doesPlayerExist, true)
      } else {
         fail('Should not reach here!')
      }

      //Test getPlayerAccount
      const playerAccountFromDatabase = await playerDataStore.getPlayerAccount(
         newPlayerId,
      )
      assert(playerAccountFromDatabase)
      if ('playerId' in playerAccountFromDatabase) {
         assertEquals(playerAccountFromDatabase.playerId, newPlayerId)
         assertEquals(playerAccountFromDatabase.name, 'Test Player')
         assertEquals(playerAccountFromDatabase.userName, 'playerUserName')
         assertEquals(
            playerAccountFromDatabase.userPassword,
            'playerUserPassword',
         )
      } else {
         fail('Should not reach here!')
      }

      //Should not get a PlayerAccount for a non-existing playerId
      const nonExistingPlayerAccount = await playerDataStore.getPlayerAccount(
         'doesNotExist',
      )
      assertEquals(nonExistingPlayerAccount, undefined)

      // Test set and get playerAccessToken
      const playerAccessToken = await playerDataStore.setPlayerAccessToken(
         newPlayerId,
         'AT-123',
      )
      if (typeof playerAccessToken === 'string') {
         assertEquals(playerAccessToken, 'AT-123')
         const playerAccessTokenFromDatabase = await playerDataStore
            .getAccessTokenForPlayer(newPlayerId)
         assert(playerAccessTokenFromDatabase)
         if (typeof playerAccessTokenFromDatabase === 'string') {
            assertEquals(playerAccessTokenFromDatabase, 'AT-123')
         } else {
            fail('Should not reach here!')
         }

         // Should not get an access token if player does not exist
         const nonExistingPlayerAccessToken = await playerDataStore
            .getAccessTokenForPlayer('doesNotExists')
         assertEquals(nonExistingPlayerAccessToken, undefined)
      } else {
         fail('Should not reach here!')
      }

      const playerOne: PlayerData = {
         playerId: newPlayerId,
         name: 'Test Player',
         units: [slimeUnit, parentSlimeUnit],
      }

      await playerDataStore.createPlayer(playerOne)
      const newPlayer = await playerDataStore.getPlayer(newPlayerId)
      assert(newPlayer)
      if ('playerId' in newPlayer) {
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
      } else {
         fail('Should not reach here!')
      }

      // Should not get a player if playerId is undefined
      const undefinedPlayer = await playerDataStore.getPlayer(undefined)
      assertEquals(undefinedPlayer, undefined)

      // Should not get a player if Player wit playerId does not exist
      const nonExistingPlayer = await playerDataStore.getPlayer('doesNotExist')
      assertEquals(nonExistingPlayer, undefined)

      // Should not be able to create the same Player again
      const createPlayerResult = await playerDataStore.createPlayer(playerOne)
      if (typeof createPlayerResult === 'object') {
         assertEquals(
            createPlayerResult.errorMessage.includes('already exist'),
            true,
         )
      } else {
         fail('Should not reach here!')
      }
   } else {
      fail('Should not reach here!')
   }

   // Should not get a PlayerAccount is the user with the username does not exist
   const nonExistingPlayerAccountForName = await playerDataStore
      .getPlayerAccountForName('unknownPlayer')
   assertEquals(nonExistingPlayerAccountForName, undefined)

   // Should get an error if inserting a PlayerAccessToken fails
   playerDataStore.insertAccessToken = async function () {
      return await new Promise((resolve) => {
         resolve({ ok: false })
      })
   }

   const accessTokenInsertError = await playerDataStore.setPlayerAccessToken(
      newPlayerId,
      'AT-123',
   )
   if (typeof accessTokenInsertError === 'object') {
      assertEquals(
         accessTokenInsertError.errorMessage,
         `An error occurred while inserting access token for player ${newPlayerId}`,
      )
   } else {
      fail('Should not reach here!')
   }

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
