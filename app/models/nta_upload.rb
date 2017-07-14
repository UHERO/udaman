class NtaUpload < ActiveRecord::Base
  require 'date'
  before_destroy :delete_files_from_disk
  before_destroy :delete_data_and_data_sources

  enum status: { processing: 'processing', ok: 'ok', fail: 'fail' }

  def store_upload_files(series_file)
    now = Time.now.localtime
    return false unless series_file
    series_file_content = series_file.read
    series_file_ext = series_file.original_filename.split('.')[-1]
    self.series_filename = NtaUpload.make_filename(now, 'series', series_file_ext)
    self.series_status = :processing

    self.upload_at = Time.now
    begin
      self.save or raise StandardError, 'NTA upload object save failed'
      write_file_to_disk(series_filename, series_file_content) or raise StandardError, 'NTA upload disk write failed'
      NtaCsvWorker.perform_async(id, 'series')
    rescue => e
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
  end

  def set_active(status)
    self.update! :active => status
  end

  def make_active
    return true ##### TEMP: during development
    NtaUpload.update_all active: false
    NtaLoadWorker.perform_async(self.id)
    self.update cats_status: 'processing'
  end

  def make_active_settings
    return true ##### TEMP: during development
    return false unless DataPoint.update_public_data_points
    logger.debug { 'DONE DataPoint.update_public_data_points' }
    NtaUpload.update_all active: false
    self.update! active: true, last_error: nil, last_error_at: nil
  end

  def get_status(which)
    if which == 'cats'
      cats_status
    else
      series_status
    end
  end

  def set_status(which, status)
    if which == 'cats'
      self.update_attributes(:cats_status => status)
    else
      self.update_attributes(:series_status => status)
    end
  end

  def absolute_path(which = nil)
    if which == 'cats'
      path(cats_filename)
    elsif which == 'series'
      path(series_filename)
    else
      path
    end
  end

  def retrieve_series_file
    read_file_from_disk(series_filename)
  end

  def delete_series_file
    xlspath = absolute_path('series')
    if series_filename && File.exists?(xlspath)
      r = delete_file_from_disk xlspath
      r &&= FileUtils.rm_rf xlspath.change_file_extension('')  ## the dir containing csv files -dji
      return r
    end
    true
  end

  def load_csv(which)
    if which == 'cats'
      return load_cats_csv
    end
    load_series_csv
  end

  def load_cats_csv
    logger.debug { 'starting load_cats_csv' }
    unless series_filename
      raise 'load_cats_csv: no series_filename'
    end
    csv_path = path(series_filename).change_file_extension('')
    unless Dir.exists?(csv_path) || ENV['OTHER_WORKER'] && system("rsync -rt #{ENV['OTHER_WORKER'] + ':' + csv_path} #{absolute_path}")
      raise "load_cats_csv: couldn't find csv dir #{csv_path}"
    end
    cats_path = File.join(csv_path, 'description.csv')
    unless File.exists?(cats_path)
      raise "load_cats_csv: couldn't find file #{cats_path}"
    end
    # clean out the things, but not the root category
    Category.where('universe = "NTA" and ancestry is not null').delete_all
    DataList.where(universe: 'NTA').destroy_all
 ######################### what-all is destroyed by the above? what needs to be?
    root = Category.find_by(universe: 'NTA', ancestry: nil).pluck(:id) || raise('No NTA root category found')

    CSV.foreach(cats_path, {col_sep: "\t", headers: true, return_headers: false}) do |row|
      next unless row[2] =~ /indicator/i

      data_list_name = "NTA_#{row[0].strip}"
      long_name = row[1].strip
      parent_cat_name = row[4].strip
      parent_cat = Category.find_by(universe: 'NTA', name: parent_cat_name) ||
                    Category.create(universe: 'NTA', name: parent_cat_name, ancestry: root)
      ancestry = "#{root}/#{parent_cat.id}"
      category = Category.find_by(universe: 'NTA', meta: data_list_name) ||
                  Category.create(universe: 'NTA', meta: data_list_name, name: long_name, ancestry: ancestry)

      # data_list & measurements
      data_list = DataList.create(universe: 'NTA', name: data_list_name)
      category.update data_list_id: data_list.id
      measurement = Measurement.find_by(universe: 'NTA', prefix: data_list_name)
      if measurement.nil?
        measurement = Measurement.create(
            universe: 'NTA',
            prefix: data_list_name,
            data_portal_name: long_name
        )
      else
        measurement.update data_portal_name: long_name
      end
      if data_list.measurements.where(id: measurement.id).empty?
        data_list.measurements << measurement
        logger.debug "added measurement #{measurement.prefix} to data_list #{data_list.name}"
        ## No ordering is applied in this case because there is only one measurement per DL -dji
      end
      #########          source_id = Source.get_or_new_nta(row[9]).id

    end
    true
  end

  def load_series_csv(run_active_settings = false)
    logger.debug { 'starting load_series_csv' }
    unless series_filename
      raise 'load_series_csv: no series_filename'
    end
    csv_path = path(series_filename).change_file_extension('')
    unless Dir.exists?(csv_path) || ENV['OTHER_WORKER'] && system("rsync -rt #{ENV['OTHER_WORKER'] + ':' + csv_path} #{absolute_path}")
      raise "load_series_csv: couldn't find csv dir #{csv_path}"
    end
    series_path = File.join(csv_path, 'database.csv')
    unless File.exists?(series_path)
      raise "load_series_csv: couldn't find file #{series_path}"
    end

    # if data_sources exist => set their current flag to true
    if DataSource.where("eval LIKE 'NtaUpload.load(#{id},%)'").count > 0
      logger.debug { 'NTA data already loaded' }
      NtaUpload.connection.execute <<~SQL
        UPDATE data_points SET current = 0
        WHERE data_points.data_source_id IN (SELECT id FROM data_sources WHERE eval LIKE 'NtaUpload.load(%)');
      SQL
      NtaUpload.connection.execute <<~SQL
        UPDATE data_points SET current = 1
        WHERE data_points.data_source_id IN (SELECT id FROM data_sources WHERE eval LIKE 'NtaUpload.load(#{id},%)');
      SQL
      return true
    end

    logger.debug { 'start loading NTA data' }
    current_series = nil
    current_data_source = nil
    data_points = []

    ## get the column headers
    headers = nil
    CSV.foreach(series_path, {col_sep: "\t", headers: true, return_headers: true}) do |row|
        headers = row.dup
        break
    end

    indicators = Category.where('universe = "NTA" and meta is not null')
    indicators.each do |cat|
      CSV.foreach(series_path, {col_sep: "\t", headers: true, return_headers: false}) do |row|
        row_data = {}
        ## convert row data array to hash keyed on column header. force all blank/empty to nil.
        headers.each {|h| cell = row.shift; row_data[h] = cell.blank? ? nil : cell.strip  }

        country = row_data['name']
        iso_handle = row_data['iso3166a']
        incgrp = row_data['incgrp2015']
        ## there should be only one measurement per data list
        measurement = cat.data_list.measurements.first rescue raise("load_series_csv: no DL and/or measurement for #{cat.name}")

        if current_series.nil? || current_series.name != series_name
            current_series = Series.find_by(name: series_name) ||
                             Series.create(
                               universe: 'NTA',
                               name: series_name,
                               dataPortalName: cat.name,
                               description: "#{cat.name} (#{country})",
                               frequency: 'year',
                               unit_id: measurement.unit_id,
                               source_id: measurement.source_id
                           )
        #### wow double check this guy
            if measurement.series.where(id: current_series.id).empty?
              measurement.series << current_series
              logger.debug "added series #{series_name} to measurement #{measurement.prefix}"
            end
            current_ds_eval = "NtaUpload.load(#{id}, #{current_series.id})"
            current_data_source = DataSource.find_by(eval: current_ds_eval)
            if current_data_source.nil?
              current_data_source = DataSource.create(
                universe: 'NTA',
                eval: current_ds_eval,
                description: "NTA Upload #{id} for #{series_name} (#{current_series.id})",
                series_id: current_series.id,
                last_run: Time.now,
                last_run_in_seconds: Time.now.to_i
              )
            else
              current_data_source.update last_run_in_seconds: Time.now.to_i
            end
            ## add geographies to db, but we don't use them otherwise
            Geography.find_by(universe: 'NTA', handle: iso_handle, incgrp2015: incgrp) ||
             Geography.create(universe: 'NTA', handle: iso_handle, incgrp2015: incgrp,
                         display_name: country, region: row_data['regn'], subregion: row_data['subregn'])
        end
        indicator_name = cat.meta.sub(/^NTA_/,'')
        data_points.push({series_id: current_series.id,
                          data_source_id: current_data_source.id,
                          date: row_data['year'] + '-01-01',
                          value: row_data[indicator_name]}) if row_data[indicator_name]
      end
    end
    if current_series && data_points.length > 0
      data_points.in_groups_of(1000) do |dps|
        values = dps.compact
                    .uniq {|dp| '%s %s %s' % [dp[:series_id], dp[:data_source_id], dp[:date]] }
                    .map {|dp| %q('%s', %s, %s, NOW(), STR_TO_DATE('%s','%%Y-%%m-%%d'), %s, false) %
                               ['NTA', dp[:series_id], dp[:data_source_id], dp[:date], dp[:value]] }
                    .join(',')
        NtaUpload.connection.execute <<~SQL
          INSERT INTO data_points (universe,series_id,data_source_id,created_at,`date`,`value`,`current`) VALUES #{values};
        SQL
      end
    end
    nta_data_sources = DataSource.where('eval LIKE "NtaUpload.load(%)"').pluck(:id)
    DataPoint.where(data_source_id: nta_data_sources).update_all(current: false)
    new_nta_data_sources = DataSource.where("eval LIKE 'NtaUpload.load(#{id},%)'").pluck(:id)
    DataPoint.where(data_source_id: new_nta_data_sources).update_all(current: true)

    run_active_settings ? self.make_active_settings : true
  end

  def NtaUpload.load(id)
    du = NtaUpload.find(id)
    du.load_series_csv(true)
  end

private
  def path(name = nil)
    parts = [ENV['DATA_PATH'], 'nta_files']
    parts.push(name) unless name.blank?
    File.join(parts)
  end

  def NtaUpload.make_filename(time, type, ext)
    ## a VERY rough heuristic for whether we have a correct file extention
    ext = ext.length > 4 ? '' : '.' + ext
    time.strftime('%Y-%m-%d-%H:%M:%S') + '_' + type + ext
  end

  def write_file_to_disk(name, content)
    begin
      File.open(path(name), 'wb') { |f| f.write(content) }
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
    true
  end

  def read_file_from_disk(name)
    begin
      content = File.open(path(name), 'r') { |f| f.read }
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
    content
  end

  def delete_file_from_disk(abspath)
    begin
      File.delete(abspath)
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
    true
  end

  def delete_files_from_disk
    delete_series_file
  end

  def delete_data_and_data_sources
    NtaUpload.connection.execute <<~SQL
      DELETE FROM data_points
      WHERE data_source_id IN (SELECT id FROM data_sources WHERE eval LIKE 'NtaUpload.load(#{self.id},%)');
    SQL
    DataSource.where("eval LIKE 'NtaUpload.load(#{self.id},%)'").delete_all
  end

  def get_geo_code(name)
    trans_hash = {
        'Hawaii County' => 'HAW',
        'Honolulu County' => 'HON',
        'Maui County' => 'MAU',
        'Kauai County' => 'KAU',
        'Statewide' => 'HI',
    }
    trans_hash[name] || 'ERROR'
  end

  def get_date(year, qm)
    if qm =~ /^M(\d+)/i
      "#{year}-%02d-01" % $1.to_i
    elsif qm =~ /^Q(\d+)/i
      quarter_month = '%02d' % (($1.to_i - 1) * 3 + 1)
      "#{year}-#{quarter_month}-01"
    elsif qm.nil? || qm.empty? || qm =~ /A/i
      "#{year}-01-01"
    else
      "#{year}-12-31"  ## use this as an error code? :=}
    end
  end

end
