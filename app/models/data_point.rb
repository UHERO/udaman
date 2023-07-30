class DataPoint < ApplicationRecord
  self.primary_key = :xseries_id, :date, :created_at, :data_source_id
  belongs_to :xseries, inverse_of: :data_points
  belongs_to :data_source
  
  def upd(value, data_source)
    return nil if trying_to_replace_with_nil?(value)
    return nil unless value_or_source_changed?(value, data_source)
    create_new_dp(value, data_source)
  end
  
  def value_or_source_changed?(value, data_source)
    unless self.value_equal_to? value
      series_auto_quarantine_check
      return true
    end
    self.data_source_id != data_source.id
  end

  def series_auto_quarantine_check
    return if series.quarantined? || series.restricted?
    return unless FeatureToggle.is_set?('auto_quarantine', true, series.universe)
    if self.date < (Date.today - 2.years)
      series.add_to_quarantine(run_update: false)
    end
  end

  def value_equal_to?(value)
    self.value.round(10) == value.round(10) rescue raise "Error rounding value at #{date}. May be non-numeric."
  end

  def trying_to_replace_with_nil?(value)
     value.nil? && !self.value.nil?
  end
  
  def create_new_dp(upd_value, upd_source)
    return nil if upd_source.priority < self.data_source.priority
    new_dp = DataPoint.create(
        xseries_id: self.xseries_id,
        date: self.date,
        data_source_id: upd_source.id,
        value: upd_value,
        pseudo_history: upd_source.pseudo_history,
        current: false  ## will be set to true just below
    )
    make_current(new_dp)
    new_dp
  end

  ## Should be obsolete now. But leave it around for historical consideration. Removed from production use June 2023
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

  def DataPoint.update_public_all_universes
    Rails.logger.info { 'update_public_data_points: UHERO' }
    DataPoint.update_public_data_points('UHERO')
    Rails.logger.info { 'update_public_data_points: FC' }
    DataPoint.update_public_data_points('FC')
    Rails.logger.info { 'update_public_data_points: COH' }
    DataPoint.update_public_data_points('COH')
    Rails.logger.info { 'update_public_data_points: CCOM' }
    DataPoint.update_public_data_points('CCOM')
  end

  def DataPoint.update_public_data_points(universe = 'UHERO', series = nil)
    remove_quarantine = FeatureToggle.is_set?('remove_quarantined_from_public', false, universe)
    if series && series.quarantined?
      return true unless remove_quarantine

      begin
        stmt = ActiveRecord::Base.connection.raw_connection.prepare(<<~MYSQL)
          delete from public_data_points where series_id = ?
        MYSQL
        stmt.execute(series.id)
        stmt.close
      rescue
          return false
      end
      return true
    end
    t = Time.now
    insert_type = universe == 'NTA' ? 'replace' : 'insert'
    update_query = <<~MYSQL
      update public_data_points p
        join series_all_v s on s.id = p.series_id
        join data_points d on d.xseries_id = s.xseries_id and d.date = p.date and d.current
      set p.value = d.value,
          p.pseudo_history = d.pseudo_history,
          p.updated_at = coalesce(d.updated_at, now())
      where s.universe = ?
      and not(s.quarantined)
      and (d.updated_at is null or d.updated_at > p.updated_at)
      #{' and s.id = ? ' if series} ;
    MYSQL
    insert_query = <<~MYSQL
      #{insert_type} into public_data_points (series_id, `date`, `value`, pseudo_history, created_at, updated_at)
      select s.id, d.date, d.value, d.pseudo_history, d.created_at, coalesce(d.updated_at, d.created_at)
      from series_all_v s
        join data_points d on d.xseries_id = s.xseries_id
        left join public_data_points p on p.series_id = s.id and p.date = d.date
      where s.universe = ?
      and not(s.quarantined)
      and d.current
      and p.created_at is null  /* dp doesn't exist in public_data_points yet */
      #{' and s.id = ? ' if series} ;
    MYSQL
    delete_query = <<~MYSQL
      delete p
      from public_data_points p
        join series_all_v s on s.id = p.series_id
        left join data_points d on d.xseries_id = s.xseries_id and d.date = p.date and d.current
      where s.universe = ?
      and( d.created_at is null  /* dp no longer exists in data_points */
          #{' or s.quarantined ' if remove_quarantine} )
      #{' and s.id = ? ' if series} ;
    MYSQL
    begin
      bind_vals = [universe]
      bind_vals.push(series.id) if series
      self.transaction do
        stmt = ApplicationRecord.connection.raw_connection.prepare(update_query)
        stmt.execute(*bind_vals)
        stmt.close
        Rails.logger.debug { "update_public_data_points: DONE doing update" }
        stmt = ApplicationRecord.connection.raw_connection.prepare(insert_query)
        stmt.execute(*bind_vals)
        stmt.close
        Rails.logger.debug { "update_public_data_points: DONE doing insert" }
        stmt = ApplicationRecord.connection.raw_connection.prepare(delete_query)
        stmt.execute(*bind_vals)
        stmt.close
        Rails.logger.debug { "update_public_data_points: DONE doing delete" }
      end
    rescue => e
      Rails.logger.error { "update_public_data_points: encountered an ERROR: #{e.message}" }
      return false
    end
    true
  end

end
