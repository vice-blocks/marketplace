import React from 'react'
import { Switch, Route } from 'react-router'

import locations from './locations'

import HomePage from 'components/HomePage'
import GoogleAnalytics from 'components/GoogleAnalytics'
import Intercom from 'components/Intercom'

import WalletErrorPage from './components/WalletErrorPage'
import AddressErrorPage from './components/AddressErrorPage'
import ServerError from './components/ServerError'

export default function Routes() {
  return [
    <Switch key="1">
      <Route exact path={locations.root} component={HomePage} />
      <Route exact path={locations.parcel} component={HomePage} />
      <Route exact path={locations.walletError} component={WalletErrorPage} />
      <Route exact path={locations.addressError} component={AddressErrorPage} />
      <Route exact path={locations.serverError} component={ServerError} />
      <Route exact path={locations.error} component={WalletErrorPage} />
    </Switch>,
    <Intercom key="2" />,
    <GoogleAnalytics key="3" />
  ]
}
