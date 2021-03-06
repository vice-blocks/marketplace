import React from 'react'
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'
import L from 'leaflet'
import debounce from 'lodash.debounce'

import LeafletMapCoordinates from 'lib/LeafletMapCoordinates'
import LeafletParcelGrid from 'lib/LeafletParcelGrid'

import { walletType, parcelType, districtType } from 'components/types'

import ParcelPopup from './ParcelPopup'
import { buildCoordinate } from 'lib/utils'
import { getParcelAttributes } from 'lib/parcelUtils'

import './ParcelsMap.css'

const MAP_ID = 'map'

L.Icon.Default.imagePath = 'https://cdnjs.com/ajax/libs/leaflet/1.0.3/images/'

export default class ParcelsMap extends React.Component {
  static propTypes = {
    wallet: walletType.isRequired,
    parcels: PropTypes.objectOf(parcelType).isRequired,
    districts: PropTypes.objectOf(districtType).isRequired,
    center: PropTypes.shape({
      x: PropTypes.string,
      y: PropTypes.string
    }),

    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    bounds: PropTypes.arrayOf(PropTypes.array),

    minZoom: PropTypes.number.isRequired,
    maxZoom: PropTypes.number.isRequired,
    baseZoom: PropTypes.number.isRequired,
    zoom: PropTypes.number.isRequired,
    tileSize: PropTypes.number.isRequired,

    onMoveEnd: PropTypes.func,
    onZoomEnd: PropTypes.func,
    onSelect: PropTypes.func
  }

  constructor(props) {
    super(props)
    this.debouncedAddPopup = debounce(this.addPopup, 400)
  }

  static defaultProps = {
    bounds: [[], []],
    onMoveEnd: () => {},
    onZoomEnd: () => {}
  }

  componentWillMount() {
    this.map = null
    this.parcelGrid = null
    this.mapCoordinates = null

    this.debounceMapMethodsByTileSize(this.props.tileSize)
  }

  componentWillUnmount() {
    this.removeMap()
  }

  componentWillReceiveProps(nextProps) {
    const shouldUpdateCenter =
      !this.panInProgress &&
      (this.props.x !== nextProps.x || this.props.y !== nextProps.y)

    const shouldRedraw = !!this.map

    const shouldDebounce = this.props.tileSize !== nextProps.tileSize

    if (shouldUpdateCenter) {
      if (this.skipCenter) {
        this.skipCenter = false
      } else {
        const newCenter = this.getLatLng(nextProps.x, nextProps.y)
        this.recenterMap(newCenter)
      }
    }

    if (shouldRedraw) {
      this.debouncedRedrawMap()
    }

    if (shouldDebounce) {
      this.debounceMapMethodsByTileSize(nextProps.tileSize)
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.tileSize !== nextProps.tileSize
  }

  debounceMapMethodsByTileSize(tileSize) {
    const delay = 6400
    this.debouncedRedrawMap = debounce(
      this.redrawMap,
      Math.min(200, delay / tileSize)
    )
    this.debouncedOnMoveEnd = debounce(
      this.onMoveEnd,
      Math.min(200, delay / tileSize)
    )
  }

  createMap(container) {
    const { x, y, tileSize, minZoom, maxZoom, bounds, zoom } = this.props

    this.map = new L.Map(MAP_ID, {
      minZoom,
      maxZoom,
      zoom,
      center: new L.LatLng(x, y),
      layers: [],
      renderer: L.svg(),
      zoomAnimation: false,
      scrollWheelZoom: false,
      boxZoom: false,
      doubleClickZoom: false
    })

    this.mapCoordinates = new LeafletMapCoordinates(this.map, tileSize)

    this.parcelGrid = new LeafletParcelGrid({
      getTileAttributes: this.getTileAttributes,
      onTileClick: this.onTileClick,
      onMouseDown: this.onMouseDown,
      onMouseUp: this.onMouseUp,
      onMouseMove: this.onMouseMove,
      tileSize: tileSize
    })

    this.map.zoomControl.setPosition('topright')
    this.map.setMaxBounds(this.mapCoordinates.toLatLngBounds(bounds))
    this.map.addLayer(this.parcelGrid)
    this.map.setView(this.getLatLng(x, y))

    if (!this.isNearTheCenter()) {
      // Only trigger this outside the bounds of the center,
      // 0,0 and it's surroundings are always fetched on load.
      this.onMapMoveEnd()
    }

    this.attachMapEvents()

    return this.map
  }

  attachMapEvents() {
    this.map.on('movestart', this.onMapMoveStart)
    this.map.on('moveend', this.onMapMoveEnd)
    this.map.on('zoomend', this.onZoomEnd)
  }

  recenterMap(center) {
    this.map.setView(center)
    this.redrawMap()
  }

  redrawMap = () => {
    if (this.map) {
      this.parcelGrid.renderTiles(this.map.getBounds())
    }
  }

  onMapMoveStart = () => {
    this.panInProgress = true
    this.startMove = Date.now()
    this.props.onMoveStart()
  }

  onMapMoveEnd = () => {
    const elapsed = Date.now() - this.startMove
    this.panInProgress = false
    if (elapsed > 500) {
      this.skipCenter = true
    }
    this.debouncedOnMoveEnd()
  }

  onZoomEnd = () => {
    this.props.onZoomEnd(this.map.getZoom())
    this.debouncedOnMoveEnd()
  }

  onMoveEnd = () => {
    if (this.map) {
      this.props.onMoveEnd(this.getCurrentPositionAndBounds())
    }
  }

  getCurrentPositionAndBounds() {
    const bounds = { min: {}, max: {} }
    const latlng = this.map.getCenter()
    const position = this.mapCoordinates.latLngToCartesian(latlng)
    const mapBounds = this.map.getBounds()

    const sw = this.mapCoordinates.latLngToCartesian(mapBounds.getSouthWest())
    const ne = this.mapCoordinates.latLngToCartesian(mapBounds.getNorthEast())

    bounds.min = {
      x: sw.x,
      y: sw.y
    }

    bounds.max = {
      x: ne.x,
      y: ne.y
    }

    return { position, bounds }
  }

  isNearTheCenter() {
    const { x, y } = this.props
    return x >= -20 && x <= 20 && y >= -12 && y <= 12
  }

  getLatLng(x, y) {
    return this.mapCoordinates.cartesianToLatLng({ x, y })
  }

  bindMap(container) {
    if (container) {
      this.removeMap()
      this.createMap(container)
    }
  }

  removeMap() {
    if (this.map) {
      this.map.off()
      this.map.remove()
      this.map = null
    }
  }

  // Called by the Parcel Grid on each tile render
  getTileAttributes = latlng => {
    const { x, y } = this.mapCoordinates.latLngToCartesian(latlng)
    /*
    const { x, y } = this.mapCoordinates.latLngToCartesian(latlng)
    const parcel = this.getParcelData(x, y)
    const addressState = this.props.getAddressState()
    const maxAmount = this.props.getMaxAmount()
    const pendingConfirmationBids = this.props.getPendingConfirmationBids()

    const className = parcelUtils.getClassName(
      parcel,
      addressState,
      pendingConfirmationBids
    )
    const dataset = { x, y }

    let fillColor = null

    if (!className) {
      fillColor = parcelUtils.getColorByAmount(parcel.amount, maxAmount)
    }

    return {
      className,
      dataset,
      fillColor
    }
    */
    const { wallet, parcels, districts } = this.props
    const id = buildCoordinate(x, y)
    const parcel = parcels[id]
    const district = parcel ? districts[parcel.district_id] : null
    const description = parcel ? parcel.description : null
    const { backgroundColor, color, label } = getParcelAttributes(
      wallet,
      parcel,
      district
    )
    return {
      x,
      y,
      color,
      backgroundColor,
      label,
      description
    }
  }

  // Called by the Parcel Grid on each tile click
  onTileClick = latlng => {
    const { x, y } = this.mapCoordinates.latLngToCartesian(latlng)

    // const parcel = this.getParcelData(x, y)
    // setTimeout(() => this.parcelGrid && this.parcelGrid.loadCell(tile, 0), 10)

    const { onSelect } = this.props
    onSelect(x, y)
  }

  onMouseDown = latlng => {
    this.dragging = true
    if (this.popup) {
      this.popup.remove()
    }
  }

  onMouseUp = latlng => {
    this.dragging = false
  }

  onMouseMove = latlng => {
    if (this.dragging) {
      return
    }
    const { x, y } = this.mapCoordinates.latLngToCartesian(latlng)

    if (
      !this.tileHovered ||
      this.tileHovered.x !== x ||
      this.tileHovered.y !== y
    ) {
      if (this.popup) {
        this.popup.remove()
      }
      this.tileHovered = { x, y }
      this.debouncedAddPopup(x, y, latlng)
    }
  }

  // Called by the Parcel Grid on each tile hover
  addPopup = (x, y, latlng) => {
    if (this.dragging) {
      return
    }
    const {
      color,
      label,
      backgroundColor,
      description
    } = this.getTileAttributes(latlng)

    const leafletPopup = L.popup({ direction: 'top', autoPan: false })

    const popup = renderToDOM(
      <ParcelPopup
        x={x}
        y={y}
        color={color}
        backgroundColor={backgroundColor}
        label={label}
        description={description}
      />
    )

    leafletPopup
      .setLatLng(latlng)
      .setContent(popup)
      .addTo(this.map)

    this.popup = leafletPopup

    return leafletPopup
  }

  getParcelData = (x, y) => {
    // const parcelStates = this.props.getParcelStates() // TODO
    // let parcel = parcelStates[buildCoordinate(x, y)]

    // if (parcelStates.error && !parcel) {
    //   parcel = { error: true }
    // }

    // return parcel
    console.log('getParcelData', { x, y })
    return null
  }

  render() {
    return <div id={MAP_ID} ref={this.bindMap.bind(this)} />
  }
}

function renderToDOM(Component) {
  const div = L.DomUtil.create('div')
  ReactDOM.render(Component, div)
  return div
}
