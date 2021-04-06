module SeriesArithmetic
  include ActionView::Helpers::DateHelper

  def round(prec = 0)
    new_transformation("Rounded #{self}", data.map {|date, value| [date, value && value.round(prec).to_f] })
  end
  
  def perform_arithmetic_operation(operator, op_series)
    validate_arithmetic(op_series)
    new_data = {}
    longer_series = self.data.length > op_series.data.length ? self : op_series
    longer_series.data.keys.each do |date|
      my_val = self.at(date)
      op_val = op_series.at(date)
      computed = my_val && op_val && my_val.send(operator, op_val)
      new_data[date] = (computed && (computed.nan? || computed.infinite?)) ? nil : computed
    end
    new_transformation("#{self} #{operator} #{op_series}", new_data)
  end

  def perform_const_arithmetic_op(operator, constant)
    new_data = data.map {|date, value| [date, value && value.send(operator, constant)] }
    new_transformation("#{self} #{operator} #{constant}", new_data)
  end
  
  def zero_add(op_series)
    validate_arithmetic(op_series)
    longer_series = self.data.length > op_series.data.length ? self : op_series
    new_data = longer_series.data.map {|date, _| [date, self.at(date).to_f + op_series.at(date).to_f] }
    ## to_f() will convert a nil to 0.0. But if both series have nil, shouldn't output be nil??
    ## Is it possible for both to have nil?
    new_transformation("#{self} zero_add #{op_series}", new_data)
  end
  
  def +(other_series)
    if other_series.class == Series
      validate_additive_arithmetic(other_series)
      new_series = perform_arithmetic_operation('+',other_series)
    else
      new_series = perform_const_arithmetic_op('+', other_series)
    end
    new_series.units = self.units
    new_series
  end
  
  def -(other_series)
    if other_series.class == Series
      validate_additive_arithmetic(other_series)
      new_series = perform_arithmetic_operation('-',other_series)
    else
      new_series = perform_const_arithmetic_op('-', other_series)
    end    
    new_series.units = self.units
    new_series
  end

  def **(other_series)
    #not definint units for now... will add if becomes an issue
    return perform_const_arithmetic_op('**', other_series) unless other_series.class == Series
    perform_arithmetic_operation('**',other_series)
  end
  
  def *(other_series)
    #not definint units for now... will add if becomes an issue
    return perform_const_arithmetic_op('*', other_series) unless other_series.class == Series
    perform_arithmetic_operation('*',other_series)
  end
  
  def /(other_series)
    #not definint units for now... will add if becomes an issue
    #also not converting the to float. Tests are passing, so looks ok. May need to change later
    return perform_const_arithmetic_op('/', other_series) unless other_series.class == Series
    perform_arithmetic_operation('/',other_series)
  end

  def rebase(date = nil)
    if date
      date = Date.parse(date) rescue raise('Rebase arg must be a string "YYYY-01-01"')
    end
    ## We need an annual series. If I am annual, this'll find me, otherwise my .A sibling
    ann_series = find_sibling_for_freq('A') || raise("No annual series corresponding to #{self}")
    date ||= ann_series.last_observation
    new_base = ann_series.at(date).to_f
    raise "No nonzero rebase of #{self} to #{date}" unless new_base && new_base != 0

    new_series_data = {}
    data.sort.each do |at_date, value|
      new_series_data[at_date] = value / new_base * 100
    end
    new_transformation("Rebased #{self} to #{date}", new_series_data)
  end

  def percentage_change
    new_series_data = {}
    last = nil
    data.sort.each do |date, value|
      pc = compute_percentage_change(value, last)
      unless pc.nil?
        new_series_data[date] = pc
      end
      last = value
    end
    new_transformation("Percentage change of #{name}", new_series_data)
  end

  def compute_percentage_change(current, last)
    case
      when last.nil? || current.nil? then nil
      when last == 0 && current != 0 then nil
      when last == 0 && current == 0 then 0
      else (current - last) / last * 100
    end
  end

  ## Temporary aliases - get rid later as possible
  def level_change
    diff
  end

  def absolute_change
    diff
  end

  ## Generalized computation of change in level. Can be used for YOY, etc by changing the lag.
  def diff(lag: nil)   #### NOTE: make it so that if lag is a pure int, it counts data points (hard?!), if a time duration, then as it is now
    new_series = {}
    last_val = nil
    data.sort.each do |date, value|
      next if value.nil?
      prev = lag ? data[date - lag] : last_val
      new_series[date] = (value - prev) unless prev.nil?
      last_val = value
    end
    lag_s = lag && " w/lag #{distance_of_time_in_words(lag).sub('about ','')}"
    new_transformation("Level change of #{self}#{lag_s}", new_series)
  end

  def faster_change(id)
    new_series_data = {}
    sql = <<~MYSQL
    SELECT t1.date, t1.value, ((t1.value - t2.last_value) /
      (select coalesce(units, 1) from series_v where id = ? limit 1)) AS value_change
      FROM (
        SELECT `date`, `value`, (@rrow := @rrow + 1) AS row
		    FROM data_points d JOIN xseries x ON x.id = d.xseries_id
          CROSS JOIN (SELECT @rrow := 0) AS init
		    WHERE x.primary_series_id = ? AND `current` = 1 ORDER BY `date`
      ) AS t1
      LEFT JOIN (
        SELECT `date`, `value` AS last_value, (@other_row := @other_row + 1) AS row
		    FROM data_points d JOIN xseries x ON x.id = d.xseries_id
		      CROSS JOIN (SELECT @other_row := 1) AS init
		    WHERE x.primary_series_id = ? AND `current` = 1 ORDER BY `date`
      ) AS t2
      ON (t1.row = t2.row);
    MYSQL
    stmt = ApplicationRecord.connection.raw_connection.prepare(sql)
    stmt.execute(id, id, id).each do |row|
      date = row[0]
      val_chg = row[2]
      new_series_data[date] = val_chg if val_chg
    end
    new_transformation("Absolute Change of #{name}", new_series_data)
  end

  def all_nil
    new_transformation("All nil for dates in #{self}", data.map {|date, _| [date, nil] })
  end
  
  def yoy(id = nil)
    annualized_percentage_change(id)
  end

  #just going to leave out the 29th on leap years for now
  def annualized_percentage_change(id = nil)
    return all_nil if frequency == 'week'
    return faster_yoy(id) if id

    new_series_data = {}
    data.each do |date, value|
      pc = compute_percentage_change(value, data[date - 1.year]) || next
      new_series_data[date] = pc
    end
    new_transformation("Annualized Percentage Change of #{self}", new_series_data)
  end

  def faster_yoy(id)
    new_series_data = {}
    sql = <<~MYSQL
      SELECT t1.date, t1.value, (t1.value / t2.last_value - 1) * 100 AS yoy
      FROM (
        SELECT `value`, `date`, DATE_SUB(`date`, INTERVAL 1 YEAR) AS last_year
        FROM data_points d JOIN xseries x ON x.id = d.xseries_id
        WHERE x.primary_series_id = ? AND `current` = 1
      ) AS t1
      LEFT JOIN (
        SELECT `value` AS last_value, `date`
        FROM data_points d JOIN xseries x ON x.id = d.xseries_id
        WHERE x.primary_series_id = ? and `current` = 1
      ) AS t2
      ON (t1.last_year = t2.date);
    MYSQL
    stmt = ApplicationRecord.connection.raw_connection.prepare(sql)
    stmt.execute(id, id).each do |row|
      date = row[0]
      yoy = row[2]
      new_series_data[date] = yoy if yoy
    end
    new_transformation("Annualized Percentage Change of #{name}", new_series_data)
  end
  
  def mtd_sum
    return all_nil unless frequency == 'day'
    sum_series = {}
    mtd_sum = 0
    last_day = 0
    track_month = nil
    data.sort.each do |date, value|
      if date.month != track_month
        track_month = date.month
        mtd_sum = 0
        last_day = 0
      end
      raise "mtd_sum: gap in daily data preceding #{date}" if (date.day - last_day) > 1 && !sum_series.empty?
      mtd_sum += value
      last_day = date.day
      sum_series[date] = mtd_sum
    end
    new_transformation("Month-To-Date sum of #{self}", sum_series)
  end

  def mtd_avg
    return all_nil unless frequency == 'day'
    avg_series = {}
    mtd_sum.data.sort.each do |date, value|
      avg_series[date] = value / date.day.to_f
    end
    new_transformation("Month-To-Date average of #{self}", avg_series)
  end

  def mtd
    mtd_avg.yoy
  end

  def ytd_sum
    return all_nil if frequency == 'week' || frequency == 'day'
    dp_month_diff = frequency == 'quarter' ? 3 : 1  ## only Q or M are possible
    sum_series = {}
    ytd_sum = 0
    prev_month = 0
    track_year = nil
    data.sort.each do |date, value|
      if date.year != track_year
        ##unless sum_series.empty? || prev_month == (frequency == 'quarter' ? 10 : 12)
        ##  raise "ytd_sum: gap in data preceding #{date}"
        ##end
        track_year = date.year
        ytd_sum = 0
        prev_month = 0
      end
      ##raise "ytd_sum: gap in data preceding #{date}" if (date.month - prev_month) > dp_month_diff && !sum_series.empty?
      ytd_sum += value
      prev_month = date.month
      sum_series[date] = ytd_sum
    end
    new_transformation("Year-To-Date sum of #{self}", sum_series)
  end
  
  def ytd(id = nil)
    ytd_percentage_change id
  end
  
  def ytd_percentage_change(id = nil)
    return all_nil if frequency == 'week' || frequency == 'day'
    return faster_ytd(id) if id
    new_transformation("Year-To-Date percentage change of #{self}", ytd_sum.data).annualized_percentage_change
  end

  def faster_ytd(id)
    new_series_data = {}
    sql = <<~MYSQL
      SELECT t1.date, t1.value, (t1.ytd / t2.last_ytd - 1) * 100 AS ytd
      FROM (
        SELECT `date`, `value`, (@sum := IF(@yr = YEAR(`date`), @sum, 0) + `value`) AS ytd,
            @yr := YEAR(`date`), DATE_SUB(`date`, INTERVAL 1 YEAR) AS last_year
        FROM data_points d JOIN xseries x ON x.id = d.xseries_id
          CROSS JOIN (SELECT @sum := 0, @yr := 0) AS init
        WHERE x.primary_series_id = ? AND `current` = 1 ORDER BY `date`
      ) AS t1
      LEFT JOIN (
        SELECT `date`, (@sum := IF(@yr = YEAR(`date`), @sum, 0) + `value`) AS last_ytd,
            @yr := year(`date`)
        FROM data_points d JOIN xseries x ON x.id = d.xseries_id
          CROSS JOIN (SELECT @sum := 0, @yr := 0) AS init
        WHERE x.primary_series_id = ? AND `current` = 1 ORDER BY `date`
      ) AS t2
      ON (t1.last_year = t2.date);
    MYSQL
    stmt = ApplicationRecord.connection.raw_connection.prepare(sql)
    stmt.execute(id, id).each do |row|
      date = row[0]
      ytd = row[2]
      new_series_data[date] = ytd if ytd
    end
    new_transformation("Year to Date Percentage Change of #{name}", new_series_data)
  end
  
  def yoy_diff
    annual_diff
  end
  
  def scaled_yoy_diff(id = nil)
    return faster_scaled_yoy_diff(id) unless id.nil?
    new_series_data = {}
    last = {}
    scaled_data.sort.each do |date, value|
      month = date.month
      new_series_data[date] = (value-last[month]) unless last[month].nil?
      last[date.month] = value
    end
    new_transformation("Scaled year over year diff of #{name}", new_series_data)
  end

  def faster_scaled_yoy_diff(id)
    new_series_data = {}
    sql = <<~MYSQL
      SELECT t1.date, t1.value, ((t1.value - t2.last_value) /
        (select coalesce(units, 1) from series_v where id = ? limit 1)) AS yoy_diff
      FROM (
        SELECT `value`, `date`, DATE_SUB(`date`, INTERVAL 1 YEAR) AS last_year
        FROM data_points d JOIN xseries x ON x.id = d.xseries_id
        WHERE x.primary_series_id = ? AND `current` = 1
      ) AS t1
      LEFT JOIN (
        SELECT `value` AS last_value, `date`
        FROM data_points d JOIN xseries x ON x.id = d.xseries_id
        WHERE x.primary_series_id = ? and `current` = 1
      ) AS t2
      ON (t1.last_year = t2.date);
    MYSQL
    stmt = ApplicationRecord.connection.raw_connection.prepare(sql)
    stmt.execute(id, id, id).each do |row|
      date = row[0]
      yoy_diff = row[2]
      new_series_data[date] = yoy_diff if yoy_diff
    end
    new_transformation("Scaled year over year diff of #{name}", new_series_data)
  end
  
  def annual_diff
    new_series_data = {}
    last = {}
    data.sort.each do |date, value|
      month = date.month
      new_series_data[date] = (value-last[month]) unless last[month].nil?
      last[date.month] = value
    end
    new_transformation("Year over year diff of #{name}", new_series_data)
  end
  
  def annual_sum
    new_series_data = {}
    annual_values = aggregate_data_by :year, :sum
    self.data.each do |date, _|
      ## don't we need a check if the annual_values array is !nil ?
      new_series_data[date] = annual_values[Date.new(date.year)]
    end
    new_transformation("Annual Sum of #{name}", new_series_data)
  end
  
  def annual_average
    #raise AnnualAverageException if self.frequency != :month and self.frequency != :quarter and self.frequency != "month" and self.frequency != "quarter"
    new_series_data = {}
    annual_values = aggregate_data_by :year, :average
    self.data.each do |date, _|
      new_series_data[date] = annual_values[Date.new(date.year)]
    end
    new_transformation("Annual Average of #{name}", new_series_data)
  end

private

  def validate_arithmetic(op_series)
    raise SeriesArithmeticException, 'Operand series frequencies incompatible' if self.frequency.freqn != op_series.frequency.freqn
  end

  def validate_additive_arithmetic(op_series)
    ## It seems we really don't need to check for units compatibility, as much as it seems like it should be necessary?
    ##raise SeriesArithmeticException, 'Operand series units incompatible' if self.units != op_series.units
  end
end
