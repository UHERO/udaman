module SeriesArithmetic
  def round
    new_series_data = {}
    data.each do |date, value|
      new_series_data[date] = value.round.to_f
    end
    new_transformation("Rounded #{name}", new_series_data)
  end
  
  def perform_arithmetic_operation(operator,other_series)
    validate_arithmetic(other_series)
    longest_series = self.data.length > other_series.data.length ? self : other_series
    new_series_data = Hash.new
    longest_series.data.keys.each do |date|
      new_series_data[date] = (self.at(date).nil? or other_series.at(date).nil?) ? nil : self.at(date).send(operator,other_series.at(date))
      new_series_data[date] = nil if !new_series_data[date].nil? and (new_series_data[date].nan? or new_series_data[date].infinite?)
    end
    new_transformation("#{self.name} #{operator} #{other_series.name}",new_series_data)
  end

  def perform_const_arithmetic_op(operator, constant)
    new_series_data = Hash.new
    self.data.keys.each do |date|
      new_series_data[date] = self.at(date).nil? ? nil : self.at(date).send(operator,constant)
    end
    new_transformation("#{self.name} #{operator} #{constant}", new_series_data)
  end    
  
  def zero_add(other_series)
    validate_arithmetic(other_series)
    longest_series = self.data.length > other_series.data.length ? self : other_series
    new_series_data = Hash.new
    longest_series.data.keys.each do |date|
      elem1 = elem2 = 0
      elem1 = self.at(date) unless self.at(date).nil?
      elem2 = other_series.at(date) unless other_series.at(date).nil?
      new_series_data[date] = elem1 + elem2
    end
    new_transformation("#{self.name} zero_add #{other_series.name}",new_series_data)
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

  #need to figure out the best way to validate these now... For now assume the right division
  
  def validate_additive_arithmetic(other_series)
    #raise SeriesArithmeticException if self.units != other_series.units
  end
  
  def validate_arithmetic(other_series)
    #puts "#{self.name}: #{self.frequency}, other - #{other_series.name}: #{other_series.frequency}"
    #raise SeriesArithmeticException if self.frequency.to_s != other_series.frequency.to_s
    #raise SeriesArithmeticException if self.frequency.nil? or other_series.frequency.nil?
  end
  
  def rebase(year = nil)
    unless year.nil?
      year = Date.parse(year).year
    end
    new_series_data = {}
    if frequency != 'year' and frequency != :year
      annual_series = (self.name.split('.')[0] + '.A').ts
      if year.nil?
        year = annual_series.data.keys.sort[-1].year
      end
      new_base = annual_series.at(Date.new(year)).to_f
    else
      if year.nil?
        year = self.data.keys.sort[-1].year
      end
      new_base = self.at(Date.new(year)).to_f
    end
    if new_base && new_base != 0
      data.sort.each do |inner_date, value|
        new_series_data[inner_date] = value / new_base * 100
      end
    end
    new_transformation("Rebased #{name} to #{year}", new_series_data)
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
    new_transformation("Percentage Change of #{name}", new_series_data)
  end

  def compute_percentage_change(value, last)
    case
      when last.nil? then nil
      when last == 0 && value != 0 then nil
      when last == 0 && value == 0 then 0
      else (value - last) / last * 100
    end
  end

  def absolute_change(id = nil)
    return faster_change(id) unless id.nil?
    new_series_data = {}
    last = nil
    data.sort.each do |date, value|
      new_series_data[date] = value - last unless last.nil?
      last = value
    end
    new_transformation("Absolute Change of #{name}", new_series_data)
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
    new_series_data = {}
    data.each do |date, _|
      new_series_data[date] = nil
    end
    new_transformation("All nil for dates in #{name}", new_series_data)
  end
  
  def yoy(id = nil)
    annualized_percentage_change id
  end
  
  def annualized_percentage_change(id = nil)
    day_based_yoy id
  end
  
  #just going to leave out the 29th on leap years for now
  def day_based_yoy(id)
    return all_nil if frequency == 'week'
    return faster_yoy id unless id.nil?

    new_series_data = {}
    data.sort.each do |date, value|
      prev_value = data[date - 1.year]
      pc = compute_percentage_change(value, prev_value)
      unless pc.nil?
        new_series_data[date] = pc
      end
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
    new_series_data = {}
    mtd_sum = 0
    last_day = 0
    track_month = nil
    data.sort.each do |date, value|
      if date.month != track_month
        track_month = date.month
        mtd_sum = 0
        last_day = 0
      end
      raise "mtd_sum: gap in daily data preceding #{date}" if (date.day - last_day) > 1
      mtd_sum += value
      last_day = date.day
      new_series_data[date] = mtd_sum
    end
    new_transformation("Month-To-Date sum of #{self}", new_series_data)
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
    new_series_data = {}
    ytd_sum = 0
    track_year = nil
    data.sort.each do |date, value|
      if date.year != track_year
        track_year = date.year
        ytd_sum = 0
      end
      ytd_sum += value
      new_series_data[date] = ytd_sum
    end
    new_transformation("Year-To-Date sum of #{self}", new_series_data)
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
end
