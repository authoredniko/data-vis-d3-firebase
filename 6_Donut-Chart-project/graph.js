/* eslint-disable no-use-before-define */
import * as d3 from 'd3'
import { legendColor } from 'd3-svg-legend'
import d3tip from 'd3-tip'
import db from './firebase'

const dims = { height: 300, width: 300, radius: 150 }
const center = { x: dims.width / 2 + 5, y: dims.height / 2 + 5 }

const svg = d3
  .select('.canvas')
  .append('svg')
  .attr('width', dims.width + 150)
  .attr('height', dims.height + 150)

const graph = svg
  .append('g')
  .attr('transform', `translate(${center.x}, ${center.y})`)

//? LEGEND FOR THE PIE CHART
const legendGroup = svg
  .append('g')
  .attr('transform', `translate(${dims.width + 40}, 10)`)

const legend = legendColor()
  .shape('circle')
  .shapePadding(7)

//? TOOLTIP FOR PIE CHART HOVER
const tip = d3tip()
  .attr('class', 'tip card')
  .html(d => {
    return `
    <div class="name">${d.data.name}</div>
    <div class="cost">$${d.data.cost}</div>
    <div class="delete">Click slice to delete</div>
    `
  })

graph.call(tip)

//? HELPER FUNCTIONS
//* This 'pie' function analyzes the 'cost' property in our data and for each piece of data returns an array of objects each containing the original data object, the index, the startAngle, and the endAngle
const pie = d3
  .pie()
  .sort(null)
  .value(d => d.cost)

//* Arc generator, use data after it's been processed by the 'pie' function. Returns an SVG path string
const arcPath = d3
  .arc()
  .outerRadius(dims.radius)
  .innerRadius(dims.radius / 2)

//? Create an Ordinal Scale for color (NO LONGER USING)
// const color = d3.scaleOrdinal(d3.schemeSet3)

//

//* ========== TWEEN FUNCTIONS =============

//? Arc Tween Enter
const arcTweenEnter = d => {
  const i = d3.interpolate(d.endAngle, d.startAngle)
  return t => {
    return arcPath({ ...d, startAngle: i(t) })
  }
}

//? Arc Tween Update
function arcTweenUpdate(d) {
  // interpolate between previously saved state of this item (_currentState) and its updated state (d)
  const i = d3.interpolate(this._currentState, d)
  // update the current state
  this._currentState = d
  return function(t) {
    return arcPath(i(t))
  }
}

//? Arc Tween Exit
function arcTweenExit(exitItem, currentData, prevData) {
  // If item was at start of donut chart
  if (exitItem.index === 0) {
    const i = d3.interpolate(exitItem.endAngle, exitItem.startAngle)
    return t => {
      return arcPath({ ...exitItem, endAngle: i(t) })
    }
  }
  // If item was at end of donut chart
  if (exitItem.index === prevData.length - 1) {
    const i = d3.interpolate(exitItem.startAngle, exitItem.endAngle)
    return t => {
      return arcPath({ ...exitItem, startAngle: i(t) })
    }
  }
  // If item exited between start and end of donut chart
  const startIndex = exitItem.index - 1
  const endIndex = exitItem.index
  const start = d3.interpolate(
    exitItem.startAngle,
    currentData[startIndex].endAngle
  )
  const end = d3.interpolate(
    exitItem.endAngle,
    currentData[endIndex].startAngle
  )
  return t => {
    return arcPath({ ...exitItem, startAngle: start(t), endAngle: end(t) })
  }
}

//

//* ========  UPDATE FUNCTION  ============
const update = (data, prevData) => {
  // Update color scale domain (NO LONGER USING)
  // color.domain(data.map(item => item.name))

  //? Create scale of names to colors, apply to legendGroup
  const names = data.map(item => item.name)
  const colors = data.map(item => item.color)

  const ordinal = d3
    .scaleOrdinal()
    .domain(names)
    .range(colors)

  legendGroup
    .call(legend.scale(ordinal))
    .attr('opacity', 0)
    .transition()
    .duration(750)
    .attr('opacity', 1)
  legendGroup
    .selectAll('text')
    .attr('fill', 'white')
    .attr('font-weight', 'bold')

  //? Join enhanced (pie) data to path elements
  const paths = graph.selectAll('path').data(pie(data), d => d.data.id)

  //? Remove exit selection items
  const currentData = pie(data)
  paths
    .exit()
    .transition()
    .duration(750)
    .attrTween('d', d => arcTweenExit(d, currentData, prevData))
    .remove()

  //? Update items currently in the DOM
  paths
    .transition()
    .duration(750)
    .attrTween('d', arcTweenUpdate)

  //? Append any items in the enter selection
  paths
    .enter()
    .append('path')
    .attr('class', 'arc')
    .attr('stroke', '#fff')
    .attr('stroke-width', 3)
    .attr('fill', d => d.data.color)
    .each(function(d) {
      this._currentState = d
      // add a property to this item which holds its current state. Used in the 'arcTweenUpdate'
    })
    .transition()
    .duration(750)
    .attrTween('d', arcTweenEnter)

  //? ADD MOUSE-OVER EVENT TO EACH CHART SECTION (handler code below)
  graph
    .selectAll('path')
    .on('mouseover', handleMouseOver)
    .on('mouseout', handleMouseOut)
    .on('click', handleClick)
}

//? DATA ARRAYS
let data = []
let prevData = []

//* CONNECT TO FIRESTORE DB
db.collection('expenses').onSnapshot(res => {
  prevData = data

  res.docChanges().forEach(change => {
    const doc = { ...change.doc.data(), id: change.doc.id }

    switch (change.type) {
      case 'added':
        data.push(doc)
        break
      case 'modified':
        // eslint-disable-next-line no-case-declarations
        const index = data.findIndex(item => item.id === doc.id)
        if (index > -1) data[index] = doc
        break
      case 'removed':
        data = data.filter(item => item.id !== doc.id)
        break
      default:
        break
    }
  })

  update(data, prevData)
})

//* EVENT HANDLERS
const handleMouseOver = (d, i, n) => {
  tip.show(d, n[i]) // 'n[i]' replaces 'this' if using a normal function
  d3.select(n[i])
    .transition('fillMouseOver')
    .duration(300)
    .attr('fill', 'white')
    .attr('cursor', 'pointer')
}
const handleMouseOut = (d, i, n) => {
  tip.hide()
  d3.select(n[i])
    .transition('fillMouseOut')
    .duration(300)
    .attr('fill', d.data.color)
}
const handleClick = d => {
  const { id } = d.data
  db.collection('expenses')
    .doc(id)
    .delete()
}
