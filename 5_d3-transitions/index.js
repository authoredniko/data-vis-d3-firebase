import * as d3 from 'd3'
import db from './firebase'
import { widthTween } from './tweens'

//? CREATE THE MAIN SVG CONTAINER ELEMENT
const svgWidth = 600
const svgHeight = 600

const svg = d3
  .select('.canvas')
  .append('svg')
  .attr('width', svgWidth)
  .attr('height', svgHeight)
  .style('border', '1px solid black')

//? DEFINE MARGINS AND DIMENSIONS
const margin = { top: 20, right: 20, bottom: 100, left: 100 }
const graphWidth = svgWidth - margin.left - margin.right
const graphHeight = svgHeight - margin.top - margin.bottom

//? CREATE THE 'GRAPH' GROUP
const graph = svg
  .append('g')
  .attr('width', graphWidth)
  .attr('height', graphHeight)
  .attr('transform', `translate(${margin.left}, ${margin.top})`)

//? CREATE THE GRAPH AXES
const xAxisGroup = graph
  .append('g')
  .attr('transform', `translate(0, ${graphHeight})`) // move to bottom
const yAxisGroup = graph.append('g')

//? CREATE THE SCALES (w/o the domains, which depend on the data, and will be created and updated in the 'update' function)
// BAND SCALE function for the x-direction (num of bars)
const xScale = d3
  .scaleBand()
  .range([0, graphWidth])
  .paddingInner(0.2)
  .paddingOuter(0.2)

// LINEAR SCALE function for the y-direction (height)
const yScale = d3.scaleLinear().range([graphHeight, 0])

//? Create the axes
const xAxis = d3.axisBottom(xScale)
const yAxis = d3
  .axisLeft(yScale)
  .ticks(3)
  .tickFormat(d => `${d} orders`)

//? CREATE A REUSABLE TRANSITION
const t = d3.transition().duration(1000)

//

//* CREATE UPDATE FUNCTION
const update = data => {
  //? Create / Update scale domains
  xScale.domain(data.map(item => item.name)) // provides quantity and a prop name
  yScale.domain([0, d3.max(data, d => d.orders)]) // max value of all the 'order' properties

  //? Join the updated 'data' to 'rects'
  const rects = graph.selectAll('rect').data(data)

  //? Remove exit selection
  rects.exit().remove()

  //? Update current 'rect' elements already in DOM
  rects
    .attr('x', d => xScale(d.name))
    .attr('width', xScale.bandwidth)
    .style('fill', 'orange')
  // .transition(t)
  // .attr('y', d => yScale(d.orders))
  // .attr('height', d => graphHeight - yScale(d.orders))
  //* For the transition...the starting 'y' and 'height' values already exist because the elements already exist in the DOM. Therefore only need to provide the current or updated values after 'transition' method

  //? Append the 'enter' selection to the DOM with 'rect' elements
  rects
    .enter()
    .append('rect')
    .attr('x', d => xScale(d.name))
    // .attr('width', 0) // starting position for 'attrTween' below
    .attr('width', xScale.bandwidth)
    .style('fill', 'orange')
    .attr('y', graphHeight) // starting condition for transition
    .attr('height', 0) // starting condition for transition
    .merge(rects) // merges with the current 'rects' above since code beyond this point is shared (kind of pointless and messy here...)
    .transition(t) // 't' is a reusable transition created above
    // .attrTween('width', () => widthTween(xScale.bandwidth))
    .attr('y', d => yScale(d.orders)) // final condition for transition
    .attr('height', d => graphHeight - yScale(d.orders)) // final condition

  //? Call the axes
  xAxisGroup.call(xAxis)
  yAxisGroup.call(yAxis)

  //? Transform the tick text on the x-axis
  xAxisGroup
    .selectAll('text')
    .attr('text-anchor', 'end')
    .attr('transform', 'rotate(-40)')
    .attr('fill', 'orange')
    .attr('font-size', '1rem')
}

//

//? CREATE DATA ARRAY THAT WILL BE MUTATED WHEN THE DATABASE IS MODIFIED
let data = []

//? FETCH DATA - REALTIME UPDATES
db.collection('dishes').onSnapshot(res => {
  // Process all returned changes to the documents (will be one or more, length depends on number of documents currently changed/updated, NOT total number of documents in the collection)
  res.docChanges().forEach(change => {
    // Grab the document info out of the 'change' object
    const doc = { ...change.doc.data(), id: change.doc.id }

    // Update the local 'data' array based on the change type
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

  update(data)
  // console.log(data)
})
