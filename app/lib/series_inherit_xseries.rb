module SeriesInheritXseries
## These are the methods necessary for a Series object to inherit the properties/columns now contained in the Xseries
## model after the two have been separated.

  def frequency
    xseries.frequency
  end

  def frequency=(freq)
    xseries.frequency = freq
  end

end