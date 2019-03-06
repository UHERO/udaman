module SeriesAggregation
  def aggregate(frequency, operation, override_prune = false)
    new_series = new_transformation("Aggregated from #{self.name}", aggregate_data_by(frequency, operation, override_prune))
    new_series.frequency = frequency
    new_series
  end
  
  def aggregate_data_by(frequency, operation, override_prune = false)
    validate_aggregation(frequency)
    
    grouped_data = group_data_by frequency, override_prune
    aggregated_data = Hash.new
    grouped_data.keys.each do |date_string|
      aggregated_data[date_string] = grouped_data[date_string].send(operation)
    end
    aggregated_data
  end
  
  def aggregate_by(frequency, operation, override_prune = false)
    aggregate(frequency, operation, override_prune)
  end
  
  # Only returns complete groups
  def group_data_by(frequency, override_prune = false)
    validate_aggregation(frequency)

    myfreq = self.frequency.to_sym
    orig_series = self
    if myfreq == :week
      myfreq = :day
      orig_series = fill_weeks
    end
    agg_date_method = frequency.to_s + '_d' ## see date_extension.rb

    grouped_data = {}
    orig_series.data.keys.each do |date|
      value = orig_series.at(date)
      next if value.nil?
      agg_date = date.send(agg_date_method)
      grouped_data[agg_date] ||= AggregatingArray.new
      grouped_data[agg_date].push value
    end

    unless override_prune
      per = { year: { semi: 2, quarter: 4, month: 12 },
              semi: { quarter: 2, month: 6 },
              quarter: { month: 3 } }
      minimum_data_points = per[frequency] && per[frequency][myfreq]
      if myfreq == :day
        grouped_data.delete_if {|key,value| value.count != key.days_in_period(frequency.to_s) }
      elsif minimum_data_points
        grouped_data.delete_if {|_,value| value.count < minimum_data_points }
      end
    end
    grouped_data
  end

  def fill_weeks
    raise AggregationException.new, 'original series is not weekly' unless self.frequency == 'week'
    dailyseries = {}
    weekly_keys = self.data.keys.sort
    while date = weekly_keys.shift ## beware: this is an assignment, not a comparison.
      delta = weekly_keys.empty? ? 99 : date.delta_days(weekly_keys[0])
      len = delta > 10 ? 6 : delta - 1
      (0..len).each {|offset| dailyseries[date + offset] = self.data[date] }
    end
    new_transformation("Extrapolated from weekly series #{self.name}", dailyseries, :day)
  end

  def validate_aggregation(frequency)
    raise AggregationException.new, "cannot aggregate to frequency #{frequency}" unless %w[year semi quarter month].include?(frequency.to_s)
    raise AggregationException.new, "unknown frequency #{self.frequency}" unless self.frequency.freqn
    raise AggregationException.new, 'can only aggregate to a lower frequency' if frequency.freqn >= self.frequency.freqn
  end
end
