module SeriesSpecCreation
  #may consolidate the insides of these into a standard creation method later 
  #leaving old methods intact until the rest of the tests are refactored
  def Series.new_from_data_hash(name, data_hash)
    Series.new(
      name: name,
      data: data_hash[name].clone,
      xseries: Xseries.new(frequency: Series.frequency_from_name(name))
    )
  end
  
  def Series.create_from_data_hash(name, data_hash)
    new_series = Series.new(
      :name => name,
      :data => data_hash[name],
      xseries: Xseries.new(frequency: Series.frequency_from_name(name))
    )
    Series.store(name, new_series, "direct load (desc)", "direct_load (eval)")
    name.ts
  end
  
  #for testing in Cucumber and rspec
  def Series.create_dummy(series_name, frequency, start_date_string, start_offset = 1, end_offset = 12)
    month_multiplier = 1 if frequency == :month
    month_multiplier = 3 if frequency == :quarter
    month_multiplier = 6 if frequency == :semi
    month_multiplier = 12 if frequency == :year
    dataseries = {}
    date = Date.parse start_date_string
    (start_offset..end_offset).each do |offset|
      dataseries[(date>>offset*month_multiplier)] = offset
    end
    Series.create(
      :name => series_name,
      xseries: Xseries.new(frequency: frequency),
      :data => dataseries
    )
  end
end
