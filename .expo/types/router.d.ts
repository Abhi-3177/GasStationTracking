/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(auth)` | `/(auth)/login` | `/(auth)/signup` | `/(tabs)` | `/(tabs)/` | `/(tabs)/accounts` | `/(tabs)/analytical` | `/(tabs)/daily-record` | `/(tabs)/history` | `/(tabs)/reports` | `/(tabs)/settings` | `/_sitemap` | `/accounts` | `/analytical` | `/daily-record` | `/history` | `/login` | `/reports` | `/reports/account-statement` | `/reports/aged-debtors` | `/reports/monthly-sales` | `/reports/stock-report` | `/settings` | `/signup`;
      DynamicRoutes: `/account/${Router.SingleRoutePart<T>}`;
      DynamicRouteTemplate: `/account/[id]`;
    }
  }
}
