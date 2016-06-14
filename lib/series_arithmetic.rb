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
  
  def rebase(date)
    new_series_data = {}
    
    if frequency != 'year' or frequency != :year
      annual_series = (self.name.split('.')[0] + '.A').ts
      new_base = annual_series.at(date).to_f
    else
      new_base = self.at(date).to_f
    end
    data.sort.each do |date, value|
      new_series_data[date] = value / new_base * 100
    end
    new_transformation("Rebased #{name} to #{date}", new_series_data)
  end
  
  def percentage_change
    new_series_data = {}
    last = nil
    data.sort.each do |date, value|
      new_series_data[date] = (value-last)/last*100 unless last.nil?
      last = value
    end
    new_transformation("Percentage Change of #{name}", new_series_data)
  end
  
  def absolute_change(id=nil)
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
    sql = %[
    SELECT t1.date, t1.value, t1.value - t2.last_value /
      (select if(units is null, 1, units) as units from series where id = #{id} limit 1)
      AS value_change
      FROM (SELECT date, value, @row := @row + 1 AS row
		    FROM data_points CROSS JOIN (SELECT @row := 0) AS init
		    WHERE series_id = #{id} AND current = 1 ORDER BY date) AS t1
      LEFT JOIN (SELECT date, value AS last_value, @other_row := @other_row + 1 AS row
		    FROM data_points CROSS JOIN (SELECT @other_row := 1) AS init
		    WHERE series_id = #{id} AND current = 1 ORDER BY date) AS t2
      ON (t1.row = t2.row);
    ]
    ActiveRecord::Base.connection.execute(sql).each(:as => :hash) do |row|
      new_series_data[row['date']] = row['value_change'] unless row['value_change'].nil?
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
  
  def yoy(id=nil)
    annualized_percentage_change id
  end
  
  def annualized_percentage_change(id=nil)
    day_based_yoy id
  end
  
  def old_annualized_percent_change
    return all_nil unless %w(day week).index(frequency).nil?
    new_series_data = {}
    last = {}
    data.sort.each do |date, value|
      month = date.month
      new_series_data[date] = (value-last[month])/last[month]*100 unless last[month].nil?
      last[date.month] = value
    end
    new_transformation("Annualized Percentage Change of #{name}", new_series_data)
  end
  
  #just going to leave out the 29th on leap years for now
  def day_based_yoy(id)
    return all_nil unless ['week'].index(frequency).nil?
    return faster_yoy id unless id.nil?

    new_series_data = {}
    data.sort.each do |date, value|
      last_year_date = date - 1.year
      new_series_data[date] = (value-data[last_year_date])/data[last_year_date]*100 unless data[last_year_date].nil?
    end
    new_transformation("Annualized Percentage Change of #{name}", new_series_data)
  end

  def faster_yoy(id)
    new_series_data = {}
    sql = %[
      SELECT t1.value, t1.date, (t1.value/t2.last_value - 1)*100 AS yoy
      FROM (SELECT value, date, DATE_SUB(date, INTERVAL 1 YEAR) AS last_year
            FROM data_points WHERE series_id = #{id} AND current = 1) AS t1
      LEFT JOIN (SELECT value AS last_value, date
            FROM data_points WHERE series_id = #{id} and current = 1) AS t2
      ON (t1.last_year = t2.date);
    ]
    ActiveRecord::Base.connection.execute(sql).each(:as => :hash) do |row|
      new_series_data[row['date']] = row['yoy'] unless row['yoy'].nil?
    end
    new_transformation("Annualized Percentage Change of #{name}", new_series_data)
  end
  
  #should unify these a bit
  def mtd_sum
    return all_nil unless frequency == 'day'
    new_series_data = {}
    mtd_sum = 0
    mtd_month = nil
    data.sort.each do |date, value|
      month = date.month
      if month == mtd_month
        mtd_sum += value
      else
        mtd_sum = value
        mtd_month = month
      end
      new_series_data[date] = mtd_sum
    end
    new_transformation("Month to Date sum of #{name}", new_series_data)    
  end
  
  def mtd
    mtd_sum.yoy
  end
  
  def ytd_sum
    return all_nil unless %w(day week).index(frequency).nil?
    new_series_data = {}
    ytd_sum = 0
    ytd_year = nil
    data.sort.each do |date, value|
      year = date.year
      if year == ytd_year
        ytd_sum += value
      else
        ytd_sum = value
        ytd_year = year
      end
      new_series_data[date] = ytd_sum
    end
    new_transformation("Year to Date sum of #{name}", new_series_data)
  end
  
  def ytd(id=nil)
    ytd_percentage_change id
  end
  
  def ytd_percentage_change(id=nil)
    return all_nil unless %w(day week).index(frequency).nil?
    return faster_ytd(id) unless id.nil?
    new_series_data = {}
    ytd_sum = 0
    ytd_year = nil
    data.sort.each do |date, value|
      year = date.year
      if year == ytd_year
        ytd_sum += value
      else
        ytd_sum = value
        ytd_year = year
      end
      new_series_data[date] = ytd_sum
    end
    new_transformation("Year to Date Percentage Change of #{name}", new_series_data).annualized_percentage_change
  end

  def faster_ytd(id)
    new_series_data = {}
    sql = %[
      SELECT t1.date, t1.value, (t1.ytd/t2.last_ytd - 1)*100 AS ytd
      FROM (SELECT date, value, @sum := IF(@year = YEAR(date), @sum, 0) + value AS ytd,
            @year := year(date), DATE_SUB(date, INTERVAL 1 YEAR) AS last_year
          FROM data_points CROSS JOIN (SELECT @sum := 0, @year := 0) AS init
          WHERE series_id = #{id} AND current = 1 ORDER BY date) AS t1
      LEFT JOIN (SELECT date, @sum := IF(@year = YEAR(date), @sum, 0) + value AS last_ytd,
            @year := year(date)
          FROM data_points CROSS JOIN (SELECT @sum := 0, @year := 0) AS init
          WHERE series_id = #{id} AND current = 1 ORDER BY date) AS t2
      ON (t1.last_year = t2.date);
    ]
    ActiveRecord::Base.connection.execute(sql).each(:as => :hash) do |row|
      new_series_data[row['date']] = row['ytd'] unless row['ytd'].nil?
    end
    new_transformation("Year to Date Percentage Change of #{name}", new_series_data)
  end
  
  def yoy_diff
    annual_diff
  end
  
  def scaled_yoy_diff(id=nil)
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
    sql = %[
      SELECT t1.value, t1.date, (t1.value - t2.last_value) /
      (select if(units is null, 1, units) as units from series where id = #{id} limit 1)
       AS yoy_diff
      FROM (SELECT value, date, DATE_SUB(date, INTERVAL 1 YEAR) AS last_year
            FROM data_points WHERE series_id = #{id} AND current = 1) AS t1
      LEFT JOIN (SELECT value AS last_value, date
            FROM data_points WHERE series_id = #{id} and current = 1) AS t2
      ON (t1.last_year = t2.date);
    ]
    ActiveRecord::Base.connection.execute(sql).each(:as => :hash) do |row|
      new_series_data[row['date']] = row['yoy_diff'] unless row['yoy_diff'].nil?
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
    #puts "#{self.name}: FREQUENCY: #{self.frequency} - #{self.frequency.class}"    
    #raise AnnualAverageException if self.frequency != :month and self.frequency != :quarter and self.frequency != "month" and self.frequency != "quarter"
    new_series_data = {}
    annual_values = aggregate_data_by :year, :sum
    self.data.each do |date, _|
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
