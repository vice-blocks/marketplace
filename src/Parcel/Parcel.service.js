import { Contract } from 'decentraland-commons'
import { LANDRegistry } from 'decentraland-contracts'

import Parcel from './Parcel'
import coordinates from './coordinates'

class ParcelService {
  constructor() {
    this.Parcel = Parcel
  }

  async insertMatrix(minX, minY, maxX, maxY) {
    for (let x = minX; x <= maxX; x++) {
      const inserts = []

      for (let y = minY; y <= maxY; y++) {
        inserts.push(this.Parcel.insert({ x, y }).catch(skipDuplicateError))
      }

      await Promise.all(inserts)
    }
  }

  async getLandOf(address) {
    const parcels = []

    try {
      const contract = LANDRegistry.getInstance()
      const [xCoords, yCoords] = await contract.landOf(address)

      for (let i = 0; i < xCoords.length; i++) {
        const x = xCoords[i].toString()
        const y = yCoords[i].toString()

        parcels.push({ x, y })
      }
    } catch (error) {
      // Use default
    }

    return parcels
  }

  async isOwner(address, parcel) {
    let isOwner = false

    try {
      const contract = LANDRegistry.getInstance()
      const { x, y } = parcel

      const owner = await contract.ownerOfLand(x, y)
      isOwner = !Contract.isEmptyAddress(owner) && address === owner
    } catch (error) {
      // Use default
    }
    return isOwner
  }

  async addOwners(parcels) {
    let newParcels = []

    try {
      const { x, y } = coordinates.splitPairs(parcels)
      const contract = LANDRegistry.getInstance()
      const addresses = await contract.ownerOfLandMany(x, y)

      for (const [index, parcel] of parcels.entries()) {
        const address = addresses[index]
        const owner = Contract.isEmptyAddress(address) ? null : address
        newParcels.push({ ...parcel, owner })
      }
    } catch (error) {
      newParcels = parcels
    }

    return newParcels
  }

  async addDbData(parcels) {
    const parcelIds = parcels.map(parcel => Parcel.buildId(parcel.x, parcel.y))

    const dbParcels = await Parcel.findInIds(parcelIds)
    const dbParcelsObj = this.toParcelObject(dbParcels)

    return parcels.map((parcel, index) => {
      const dbParcel = dbParcelsObj[Parcel.buildId(parcel.x, parcel.y)]
      if (!dbParcel) return parcel

      const { name, description, price } = dbParcel
      return Object.assign({ name, description, price }, parcel)
    })
  }

  toParcelObject(parcelArray) {
    return parcelArray.reduce((map, parcel) => {
      map[parcel.id] = parcel
      return map
    }, {})
  }

  getValuesFromSignedMessage(signedMessage) {
    const values = signedMessage.extract(Parcel.columnNames)
    const changes = {}

    for (const [index, columnName] of Parcel.columnNames.entries()) {
      const value = values[index]

      if (value) {
        changes[columnName] = value
      }
    }

    return changes
  }
}

function skipDuplicateError(error) {
  if (!isDuplicatedError(error)) throw new Error(error)
}

function isDuplicatedError(error) {
  const duplicateErrorRegexp = /duplicate key value violates unique constraint ".+_pkey"/
  return error && error.search && error.search(duplicateErrorRegexp) !== -1
}

export default ParcelService
