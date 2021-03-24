module SeriesAggregation
  def aggregate_data_by(frequency, operation, prune: true)
    validate_aggregation(frequency)

    orig_series = self.frequency.to_sym == :week ? interpolate_week_to_day(operation) : self
    grouped_data = orig_series.group_data_by(frequency, prune: prune)
    aggregated_data = {}
    grouped_data.keys.each do |date_string|
      aggregated_data[date_string] = grouped_data[date_string].send(operation)
    end
    aggregated_data
  end

  def aggregate(frequency, operation, prune: true)
    new_transformation("Aggregated from #{self}", aggregate_data_by(frequency, operation, prune: prune), frequency)
  end

  def aggregate_by(frequency, operation, prune: true)
    aggregate(frequency, operation, prune: prune)
  end
  
  # Only returns complete groups
  def group_data_by(frequency, prune: true)
    validate_aggregation(frequency)
    agg_date_method = frequency.to_s + '_d' ## see date_extension.rb

    grouped_data = {}
    data.keys.each do |date|
      value = self.at(date) || next
      agg_date = date.send(agg_date_method)
      grouped_data[agg_date] ||= AggregatingArray.new
      grouped_data[agg_date].push value
    end

    if prune   ## normally (default) true
      myfreq = self.frequency.to_sym
      minimum_data_points = freq_per_freq(myfreq, frequency)
      if myfreq == :day
        grouped_data.delete_if {|date, group| group.count != date.days_in_period(frequency) }
      elsif minimum_data_points
        grouped_data.delete_if {|_, group| group.count < minimum_data_points }
      end
    end
    grouped_data
  end

private

  ### Assumes that weekly observations fall at the END of the week they represent, whatever weekday that might be.
  ### It's almost always Saturday, and we should try to keep it that way. Does not try to take into account the possibility
  ## of missing data points in the source series.
  def interpolate_week_to_day(method)
    raise AggregationException.new, 'original series is not weekly' if frequency != 'week'
    dailyseries = {}
    weekly_keys = data.keys.sort
    fill_length = 10  ## overlap the preceding week to avoid any gaps
    loop do
      date = weekly_keys.pop || break  ## loop through weekly_keys, whilst removing each item from the array as you go
      fill_length = 6 if weekly_keys.empty?  ## don't overlap at the beginning
      week_value = data[date]
      (0..fill_length).each {|offset| dailyseries[date - offset] = week_value }
    end
    new_transformation("Extrapolated from weekly series #{self}", dailyseries.sort, :day)
  end

  def validate_aggregation(frequency)
    raise AggregationException.new, "cannot aggregate to frequency #{frequency}" unless %w[year semi quarter month week].include?(frequency.to_s)
    raise AggregationException.new, 'can only aggregate to a lower frequency' if frequency.freqn >= self.frequency.freqn
  end
end
