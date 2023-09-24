module SeriesSeasonalAdjustment

  def apply_seasonal_adjustment(factor_application = nil)
    raise "apply_seasonal_adjustment needs an argument of :additive or :multiplicative" unless factor_application
    ns_series = find_ns_series || raise("No NS series corresponds to #{self}")
    set_factors(factor_application, ns_series)
    new_ns_values = ns_series.get_values_after(last_demetra_date.to_date)
    adjusted_data = {}
    new_ns_values.each do |date, value|
      factor_month = date.month.to_s
      adjusted_data[date] = value - factors[factor_month] if factor_application == :additive
      adjusted_data[date] = value / factors[factor_month] if factor_application == :multiplicative
    end
    #still valuable to run as the current series because it sets the seasonal factors
    new_transformation("Applied #{factor_application} Seasonal Adjustment against #{ns_series}", adjusted_data)
  end

  ### still need this?
  def apply_growth_rate_incompl_year
    apply_ns_growth_rate_sa.no_trim_future.get_last_incomplete_year
  end

  def apply_ns_growth_rate_sa
    ns_series = find_ns_series || raise(SeasonalAdjustmentException, "No NS series corresponds to #{self}")
    shifted_self = self.shift_by(+1.year)
    adjusted_series = {}

    ns_series.data.sort.each do |date, value|
      prev = ns_series.at(date - 1.year) || next
      sval = shifted_self.at(date) || next
      apc = compute_percentage_change(value, prev)
      if prev == 0 || apc && apc > 1000000
        adjusted_series[date] = value - prev + sval
      else
        adjusted_series[date] = (1 + apc / 100.0) * sval rescue raise("Calc error: %change invalid at #{date}")
      end
    end
    new_transformation("Applied Growth Rate Based Seasonal Adjustment against #{ns_series}", adjusted_series)
  end

private

  def set_factors(factor_app, ns_series)
    factor_app = factor_app.to_sym
    raise "Unknown factor application #{factor_app}" unless [:additive, :multiplicative].include? factor_app
    self.factor_application = factor_app
    self.factors ||= {}
    last_demetra_date = (frequency == 'quarter') ? get_last_complete_4th_quarter : get_last_complete_december
    self.last_demetra_date = last_demetra_date
    last_year_of_sa_values = get_values_after(last_demetra_date - 1.year, last_demetra_date)
    last_year_of_sa_values.sort.each do |date,sa_value|
      ns_value = ns_series.at(date)
      factor_month = date.month.to_s
      self.factors[factor_month] = ns_value - sa_value if factor_app == :additive
      self.factors[factor_month] = ns_value / sa_value if factor_app == :multiplicative
    end
    self.save
  end
end
