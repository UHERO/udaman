class DataPoint < ApplicationRecord
  self.primary_key = :xseries_id, :date, :created_at, :data_source_id
  belongs_to :xseries, inverse_of: :data_points
  belongs_to :data_source
  
  def upd(value, data_source)
    return nil if trying_to_replace_with_nil?(value)
    return nil unless value_or_source_has_changed?(value, data_source)
    restore_prior_dp(value, data_source) || create_new_dp(value, data_source)
  end
  
  def value_or_source_has_changed?(value, data_source)
    unless self.value_equal_to? value
      series_auto_quarantine_check
      return true
    end
    self.data_source_id != data_source.id
  end

  def series_auto_quarantine_check
    return if series.quarantined? || series.restricted?
    return unless FeatureToggle.is_set('auto_quarantine', true, series.universe)
    if self.date < (Date.today - 2.years)
      series.add_to_quarantine(run_update: false)
    end
  end

  def value_equal_to?(value)
    #used to round to 3 digits but not doing that anymore. May need to revert
    #equality at very last digit (somewhere like 12 or 15) is off if rounding is not used. The find seems to work in MysQL but ruby equality fails
    self.value.round(10) == value.round(10)
  end

  def trying_to_replace_with_nil?(value)
     value.nil? and !self.value.nil?
  end
  
  def create_new_dp(upd_value, upd_source)
    #create a new datapoint because value or source changed
    #need to understand how to control the rounding...not sure what sets this
    #rounding doesnt work, looks like there's some kind of truncation too.
    return nil if upd_source.priority < self.data_source.priority
    ##now = Time.now
    new_dp = DataPoint.create(
        xseries_id: self.xseries_id,
        date: self.date,
        data_source_id: upd_source.id,
        value: upd_value,
        current: false  ## will be set to true just below
      #  :created_at => now,
       # :updated_at => now
    )
    make_current(new_dp)
    new_dp
  end

  def restore_prior_dp(upd_value, upd_source)
    prior_dp = DataPoint.where(xseries_id: xseries_id,
                               date: date,
                               data_source_id: upd_source.id,
                               value: upd_value).first
    return nil if prior_dp.nil?
    unless upd_source.priority < self.data_source.priority
      make_current(prior_dp)
    end
    prior_dp
  end

  def make_current(dp)
    return unless current
    self.transaction do
      self.update_attributes(current: false)
        dp.update_attributes(current: true)
    end
  end

  def delete
    most_recent = DataPoint.where(xseries_id: xseries_id,
                                  date: date,
                                  current: false).order('updated_at desc').first if current
    self.transaction do
      super
      most_recent.update_attributes(:current => true) if most_recent
    end
  end

  def series
    self.xseries.primary_series
  end

  def source_type
    source_eval = self.data_source.eval
    case 
      when source_eval.index('load_from_bls')
        return :download
      when source_eval.index('load_from_bea')
        return :download
      when source_eval.index('load_from_download')
        return :download
      when source_eval.index('load_from_fred')
        return :download
      when source_eval.index('load_from')
        return :static_file
      else
        return :identity
      end
  end
  
  def source_type_code
    case source_type
    when :download
      return 10
    when :static_file
      return 20
    when :identity
      return 30
    else
      return 40
    end
  end

  ## this appears to be vestigial. Renaming now; if nothing breaks, delete later
  def DataPoint.delete_all_created_on_DELETEME(date)
    DataPoint.where("TO_DAYS(created_at) = TO_DAYS('#{date}')").each { |dp| dp.delete }
  end

  def DataPoint.update_public_data_points(universe = 'UHERO', series = nil)
    remove_quarantine = FeatureToggle.is_set('remove_quarantined_from_public', false, universe)
    if series && series.quarantined?
      return true unless remove_quarantine

      begin
        stmt = ActiveRecord::Base.connection.raw_connection.prepare(<<~SQL)
          delete from public_data_points where series_id = ?
        SQL
        stmt.execute(series.id)
        stmt.close
      rescue
          return false
      end
      return true
    end
    t = Time.now
    insert_type = universe == 'NTA' ? 'replace' : 'insert'
    update_query = <<~SQL
      update public_data_points p
        join series s on s.id = p.series_id
        join data_points d on d.xseries_id = s.xseries_id and d.date = p.date and d.current
      set p.value = d.value,
          p.pseudo_history = d.pseudo_history,
          p.updated_at = coalesce(d.updated_at, now())
      where s.universe = ?
      and not (s.restricted or s.quarantined)
      and (d.updated_at is null or d.updated_at > p.updated_at)
      #{' and s.id = ? ' if series} ;
    SQL
    insert_query = <<~SQL
      #{insert_type} into public_data_points (series_id, `date`, `value`, pseudo_history, created_at, updated_at)
      select s.id, d.date, d.value, d.pseudo_history, d.created_at, coalesce(d.updated_at, d.created_at)
      from series s
        join data_points d on d.xseries_id = s.xseries_id
        left join public_data_points p on p.series_id = s.id and p.date = d.date
      where s.universe = ?
      and not (s.restricted or s.quarantined)
      and d.current
      and p.created_at is null  /* dp doesn't exist in public_data_points yet */
      #{' and s.id = ? ' if series} ;
    SQL
    delete_query = <<~SQL
      delete p
      from public_data_points p
        join series s on s.id = p.series_id
        left join data_points d on d.xseries_id = s.xseries_id and d.date = p.date and d.current
      where s.universe = ?
      and( d.created_at is null  /* dp no longer exists in data_points */
           #{'or s.quarantined or s.restricted' if remove_quarantine} )
      #{' and s.id = ? ' if series} ;
    SQL
    begin
      ### Refactor the following using splat * operator
      ActiveRecord::Base.transaction do
        stmt = ActiveRecord::Base.connection.raw_connection.prepare(update_query)
        series ? stmt.execute(universe, series.id) : stmt.execute(universe)
        stmt.close
        stmt = ActiveRecord::Base.connection.raw_connection.prepare(insert_query)
        series ? stmt.execute(universe, series.id) : stmt.execute(universe)
        stmt.close
        stmt = ActiveRecord::Base.connection.raw_connection.prepare(delete_query)
        series ? stmt.execute(universe, series.id) : stmt.execute(universe)
        stmt.close
      end
    rescue
        return false
    end
    if series.nil?
      CSV.open('public/rake_time.csv', 'a') do |csv|
        csv << ['update_public_data_points', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s]
      end
    end
    true
  end

end
