import {
   GeneralError,
   PlayerAccount,
   PlayerData,
   PlayerDataStore,
} from '../index.ts'

export const PLAYER_ACCOUNT_SCHEMA = 'playeraccount'
export const PLAYER_ACCOUNT_BY_USER_NAME = PLAYER_ACCOUNT_SCHEMA + 'by_username'
export const PLAYER_DATA_SCHEMA = 'playerdata'
export const PLAYER_ACCESS_TOKEN_SCHEMA = 'playeraccesstoken'

export class KVPlayerDataStore implements PlayerDataStore {
   kv?: Deno.Kv

   async getKv(): Promise<Deno.Kv> {
      if (!this.kv) {
         this.kv = await Deno.openKv()
      }
      return this.kv
   }

   async addPlayerAccount(
      playerAccount: PlayerAccount,
   ): Promise<string | GeneralError> {
      const kv = await this.getKv()
      const playerId = crypto.randomUUID()
      playerAccount.playerId = playerId
      const primaryKey = [PLAYER_ACCOUNT_SCHEMA, playerAccount.playerId]
      const byUsernameKey = [
         PLAYER_ACCOUNT_BY_USER_NAME,
         playerAccount.userName,
      ]
      const res = await kv.atomic()
         .check({ key: primaryKey, versionstamp: null })
         .check({ key: byUsernameKey, versionstamp: null })
         .set(primaryKey, playerAccount)
         .set(byUsernameKey, playerAccount)
         .commit()
      if (!res.ok) {
         return {
            errorMessage:
               `Player account with ID ${playerAccount.playerId} or username ${playerAccount.userName} already exists`,
         }
      }
      return playerId
   }

   async createPlayer(playerData: PlayerData): Promise<string | GeneralError> {
      const kv = await this.getKv()
      const primaryKey = [PLAYER_DATA_SCHEMA, playerData.playerId]

      const res = await kv.atomic()
         .check({ key: primaryKey, versionstamp: null })
         .set(primaryKey, playerData)
         .commit()
      if (!res.ok) {
         return {
            errorMessage:
               `PlayerData for player with ID ${playerData.playerId} already exists`,
         }
      }
      return playerData.playerId
   }

   async doesPlayerExist(userName: string): Promise<boolean | GeneralError> {
      return await this.getPlayerAccountForName(userName) !== undefined
   }

   async getAccessTokenForPlayer(
      playerId: string,
   ): Promise<string | undefined | GeneralError> {
      const kv = await this.getKv()
      const maybePlayerAccessToken = await kv.get<string>([
         PLAYER_ACCESS_TOKEN_SCHEMA,
         playerId,
      ])
      return maybePlayerAccessToken.value ?? undefined
   }

   async getPlayer(
      playerId: string | undefined,
   ): Promise<PlayerData | undefined | GeneralError> {
      if (playerId) {
         const kv = await this.getKv()
         const maybePlayerData = await kv.get<PlayerData>([
            PLAYER_DATA_SCHEMA,
            playerId,
         ])
         return maybePlayerData.value ?? undefined
      } else {
         return undefined
      }
   }

   async getPlayerAccount(
      playerId: string,
   ): Promise<PlayerAccount | undefined | GeneralError> {
      const kv = await this.getKv()
      const maybePlayerAccount = await kv.get<PlayerAccount>([
         PLAYER_ACCOUNT_SCHEMA,
         playerId,
      ])
      return maybePlayerAccount.value ?? undefined
   }

   async getPlayerAccountForName(
      username: string,
   ): Promise<PlayerAccount | undefined | GeneralError> {
      const kv = await this.getKv()
      const maybePlayerAccount = await kv.get<PlayerAccount>([
         PLAYER_ACCOUNT_BY_USER_NAME,
         username,
      ])
      return maybePlayerAccount.value ?? undefined
   }

   async setPlayerAccessToken(
      playerId: string,
      accessToken: string,
   ): Promise<string | GeneralError> {
      const res = await this.insertAccessToken(playerId, accessToken)
      if (!res.ok) {
         return {
            errorMessage:
               `An error occurred while inserting access token for player ${playerId}`,
         }
      }
      return accessToken
   }

   async insertAccessToken(
      playerId: string,
      accessToken: string,
   ): Promise<Deno.KvCommitResult | Deno.KvCommitError> {
      const primaryKey = [PLAYER_ACCESS_TOKEN_SCHEMA, playerId]
      const kv = await this.getKv()
      return await kv.atomic()
         .set(primaryKey, accessToken)
         .commit()
   }
}
