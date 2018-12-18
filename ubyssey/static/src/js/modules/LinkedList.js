function Node(data) {
  return {
    data,
    next: null,
    prev: null
  }
}

export default class LinkedList {
  constructor(array) {
    if (!array) {
      return null
    }

    let tail = Node(array[array.length - 1])

    for (let i = array.length - 2; i >= 0; i--) {
      let prev = Node(array[i])
      tail.prev = prev
      prev.next = tail
      tail = prev
    }

    return tail
  }
}
