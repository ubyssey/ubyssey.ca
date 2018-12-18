const dates = require('./Dates')

describe('Dates.formatPubDate', () => {
  describe('when date is falsey', () => {
    it('returns the falsey input', () => {
      expect(dates.formatPubDate()).toBeUndefined()
      expect(dates.formatPubDate(null)).toBeNull()
      expect(dates.formatPubDate(0)).toBe(0)
    })
  })

  describe('when date is valid and is at midnight', () => {
    it('formats the date as 12:mm a.m.', () => {
      expect(dates.formatPubDate(1485504761034)).toBe('Jan. 27, 2017, 12:12 a.m.')
    })
  })

  describe('when date is valid and is in the morning', () => {
    it('formats the date as hh:mm a.m.', () => {
      expect(dates.formatPubDate(1465133969034)).toBe('June 5, 2016, 6:39 a.m.')
    })
  })

  describe('when date is valid and is in the afternoon', () => {
    it('formats the date as hh:mm p.m.', () => {
      expect(dates.formatPubDate(1475524949034)).toBe('Oct. 3, 2016, 2:02 p.m.')
    })
  })
})
