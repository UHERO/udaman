module SeriesAggregation
  def aggregate_data_by(frequency, operation, prune: true)
    validate_aggregation(frequency)

    orig_series = self
    if self.frequency.to_sym == :week
      orig_series = self.interpolate_week_to_day(operation == :average ? :fill : :distribute)
    end
    grouped_data = orig_series.group_data_by(frequency, prune: prune)
    aggregated_data = {}
    grouped_data.keys.each do |date_string|
      begin
        aggregated_data[date_string] = grouped_data[date_string].send(operation)
      rescue NoMethodError
        raise "Method #{operation} is not implemented"
      end
    end
    aggregated_data
  end

  def aggregate(frequency, operation = frequency_transform, prune: true)
    raise 'No method specified for aggregate' unless operation
    if frequency_transform && frequency_transform != operation.to_s
      raise "Aggregation method #{operation} does not match that specified in source series frequency transform"
    end
    new_transformation("Aggregated as #{operation} from #{self}", aggregate_data_by(frequency, operation.to_sym, prune: prune), frequency)
  end

  def group_data_by(frequency, prune: true)
    validate_aggregation(frequency)
    agg_date_method = frequency.to_s + '_d' ## see date_extension.rb

    grouped_data = {}
    data.keys.sort.each do |date|
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

  def validate_aggregation(frequency)
    raise AggregationException.new, "cannot aggregate to frequency #{frequency}" unless %w[year semi quarter month week].include?(frequency.to_s)
    raise AggregationException.new, 'can only aggregate to a lower frequency' if frequency.freqn >= self.frequency.freqn
  end
end
