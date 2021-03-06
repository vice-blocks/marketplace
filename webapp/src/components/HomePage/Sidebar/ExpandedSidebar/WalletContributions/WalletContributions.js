import React from 'react'
import PropTypes from 'prop-types'

import ContributionTable from './ContributionTable'

import './WalletContributions.css'

class WalletParcels extends React.PureComponent {
  static propTypes = {
    wallet: PropTypes.object,
    onEdit: PropTypes.func,
    isLoading: PropTypes.bool,
    hasError: PropTypes.bool
  }

  render() {
    const { wallet, isLoading, hasError } = this.props

    if (isLoading) {
      return null
    }

    if (hasError) {
      return null
    }

    return (
      <div className="WalletContributions">
        <div className="heading">
          My Contributions&nbsp;
          <span className="parcel-count">
            {wallet.contributions.length} district{wallet.contributions.length
              ? ''
              : 's'}
          </span>
        </div>

        <ContributionTable contributions={wallet.contributions} />
      </div>
    )
  }
}

export default WalletParcels
