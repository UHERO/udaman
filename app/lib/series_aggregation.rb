module SeriesAggregation
  def aggregate_data_by(frequency, operation, prune: true)
    validate_aggregation(frequency)
    
    grouped_data = group_data_by(frequency, prune: prune)
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

    myfreq = self.frequency.to_sym
    orig_series = self
    if myfreq == :week
      myfreq = :day
      orig_series = fill_weeks_forward
    end
    agg_date_method = frequency.to_s + '_d' ## see date_extension.rb

    grouped_data = {}
    orig_series.data.keys.each do |date|
      value = orig_series.at(date) || next
      agg_date = date.send(agg_date_method)
      grouped_data[agg_date] ||= AggregatingArray.new
      grouped_data[agg_date].push value
    end

    if prune   ## normally (default) true
      minimum_data_points = freq_per_freq(myfreq, frequency)
      if myfreq == :day
        grouped_data.delete_if {|date, group| group.count != date.days_in_period(frequency) }
      elsif minimum_data_points
        grouped_data.delete_if {|_, group| group.count < minimum_data_points }
      end
    end
    grouped_data
  end

  def normalize_weekly(method = :sum)
    raise 'Only run normalize against weekly series' if frequency != 'week'
    aggregate(:week, method)
  end

private

  ### Assumes that weekly observations fall at the _beginning_ of the week they represent, whatever weekday that might be
  def fill_weeks_forward
    raise AggregationException.new, 'original series is not weekly' if frequency != 'week'
    dailyseries = {}
    weekly_keys = self.data.keys.sort
    loop do
      date = weekly_keys.shift || break  ## loop through weekly_keys, whilst removing each item from the array as you go
      delta = weekly_keys.empty? ? 99 : date.delta_days(weekly_keys[0])
      len = delta > 10 ? 6 : delta - 1
      week_value = data[date]
      (0..len).each {|offset| dailyseries[date + offset] = week_value }
    end
    new_transformation("Extrapolated from weekly series #{self}", dailyseries, :day)
  end

  def validate_aggregation(frequency)
    raise AggregationException.new, "cannot aggregate to frequency #{frequency}" unless %w[year semi quarter month week].include?(frequency.to_s)
    raise AggregationException.new, 'can only aggregate to a lower frequency' if frequency.freqn >= self.frequency.freqn
  end
end
