module SeriesInheritXseries
## These are the methods necessary for a Series object to inherit the properties/columns now contained in the Xseries
## model after the two have been separated.

  def frequency
    xseries.frequency
  end

  def frequency=(val)
    xseries.frequency = val
  end

  def seasonally_adjusted
    xseries.seasonally_adjusted
  end

  def seasonally_adjusted=(val)
    xseries.seasonally_adjusted = val
  end

  def seasonal_adjustment
    xseries.seasonal_adjustment
  end

  def seasonal_adjustment=(val)
    xseries.seasonal_adjustment = val
  end

end