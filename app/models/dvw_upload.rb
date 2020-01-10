class DvwUpload < ApplicationRecord
  include HelperUtilities
  require 'date'
  before_destroy :delete_files_from_disk
  before_destroy :delete_data_and_data_sources

  enum status: { processing: 'processing', ok: 'ok', fail: 'fail' }

  def store_upload_files(series_file)
    now = Time.now
    return false unless series_file
    series_file_content = series_file.read
    series_file_ext = series_file.original_filename.split('.')[-1]
    self.filename = DvwUpload.make_filename(now, 'series', series_file_ext)
    self.set_status('series', :processing)

    self.upload_at = Time.now
    begin
      self.save or raise StandardError, 'DVW upload object save failed'
      write_file_to_disk(filename, series_file_content) or raise StandardError, 'DVW upload disk write failed'
      DvwWorker.perform_async(id, true)
    rescue => e
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
  end

  def set_active(status)
    self.update! active: status
  end

  def make_active
    DvwUpload.update_all active: false
    DvwWorker.perform_async(self.id)
    self.update series_status: :processing
  end

  def make_active_settings
    self.transaction do
      DvwUpload.update_all active: false
      self.update active: true, last_error: nil, last_error_at: nil
    end
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
    if which == 'series'
      path(filename)
    else
      path
    end
  end

  def retrieve_series_file
    read_file_from_disk(filename)
  end

  def delete_series_file
    xlspath = absolute_path('series')
    if filename && File.exists?(xlspath)
      r = delete_file_from_disk xlspath
      r &&= FileUtils.rm_rf xlspath.change_file_extension('')  ## the dir containing csv files -dji
      return (r || throw(:abort))
    end
    true
  end

  def full_load
    mylogger :info, 'BEGIN full load'
    DvwUpload.establish_connection :dbedt_visitor

    begin
      delete_universe_dvw
      mylogger :info, 'DONE deleting the universe'

      load_meta_csv('Group')
      mylogger :debug, 'DONE load groups'
      load_meta_csv('Market')
      mylogger :debug, 'DONE load markets'
      load_meta_csv('Destination')
      mylogger :debug, 'DONE load destinations'
      load_meta_csv('Category')
      mylogger :debug, 'DONE load categories'
      load_meta_csv('Indicator')
      mylogger :debug, 'DONE load indicators'

      load_series_csv
      mylogger :debug, 'DONE load series'
      load_data_postproc
      mylogger :debug, 'DONE postproc'
    ensure
      DvwUpload.establish_connection Rails.env.to_sym  ## go back to Rails' normal db
    end
    make_active_settings
    mylogger :debug, 'DONE make active'
    mylogger :info, 'DONE full load'
    true
  end

  def delete_universe_dvw
    db_execute 'set foreign_key_checks = 0;'
    db_execute 'truncate table data_points'
    mylogger :debug, 'DONE truncating data points'
    db_execute 'truncate table indicators'
    mylogger :debug, 'DONE truncating indicators'
    db_execute 'truncate table categories'
    mylogger :debug, 'DONE truncating categories'
    db_execute 'truncate table destinations'
    mylogger :debug, 'DONE truncating destinations'
    db_execute 'truncate table markets'
    mylogger :debug, 'DONE truncating markets'
    db_execute 'truncate table groups'
    mylogger :debug, 'DONE truncating groups'
    db_execute 'set foreign_key_checks = 1;'
  end

  def load_meta_csv(dimension)
    mylogger :info, "starting load_meta_csv for #{dimension}"
    csv_dir_path = path(filename).change_file_extension('')
    csv_path = File.join(csv_dir_path, "#{dimension}.csv")
    raise "File #{csv_path} not found" unless File.exists? csv_path
    table = dimension.pluralize.downcase

    datae = []
    parent_set = []
    columns = nil
    ordering = {}

    CSV.foreach(csv_path, {col_sep: "\t", headers: true, return_headers: true}) do |row_pairs|
      unless columns
        columns = row_pairs.to_a.reject{|x,_| x.blank? || x =~ /^\s*[lo]_/i }.map{|x,_| x.strip.downcase }  ## leave out L_* and O_*
        columns.push('level', 'order')  ## add renamed/computed columns
        columns.delete('parent')  ## filled in by SQL at the end
        columns[columns.index('id')] = 'handle'    ## rename "id" column as "handle" - kinda hacky
        columns[columns.index('data')] = 'header'  ## rename "data" column as "header"
        columns.each {|c| raise("Illegal character in #{dimension} column header: #{c}") if c =~ /\W/ }
        next
      end

      row = {}
      row_pairs.to_a.each do |header, data|   ## convert row to hash keyed on column header, force blank/empty to nil
        next if header.blank?
        val = data.blank? ? nil : data.strip
        row[header.strip.downcase] = Integer(val) rescue val  ## convert integers to Integer type if possible
      end
      break if row['id'].nil?  ## in case there are blank rows appended at the end
      row['handle'] ||= row['id']  ## rename id as necessary
      if row['parent']
        parent_set.push [row['parent'], row['handle']]
      end

      row['module'].strip.split(/\s*,\s*/).each do |mod|
        ordering[mod] ||= { 1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0 }  ## assuming 5 is well above max depth
        level = row["l_#{mod.downcase}"] || row['level'] || next   ## finally just skip this entry if level is not specified
        order = row["o_#{mod.downcase}"] || incr_order(ordering[mod], level)

        row_values = []
        columns.each do |col|
          raise "Quote character in #{row['handle']} row, #{col} column" if row[col] =~ /['"]/
          row_values.push case col
                          when 'module' then mod
                          when 'header' then (row['data'].to_s == '0' ? 1 : 0)  ## semantically inverted
                          when 'level' then level
                          when 'order' then order
                          else row[col]  ## can be nil
                          end
        end
        datae.push row_values
      end
    end

    raise 'No column headers found' if columns.nil?
    cols_string = columns.map {|c| '`%s`' % c }.join(',')  ## wrap names in backtix
    qmarks = (['?'] * datae[0].count).join(',')
    insert_query = <<~MYSQL % [table, cols_string, qmarks]
      insert into %s (%s) values (%s);
    MYSQL
    mylogger :debug, "doing inserts for #{dimension}"
    db_execute_set insert_query, datae

    unless parent_set.empty?
      parent_query = <<~MYSQL % [table, table]
        update %s t1 join %s t2 on t1.module = t2.module set t2.parent_id = t1.id where t1.handle = ? and t2.handle = ?;
      MYSQL
      mylogger :debug, "doing parent updates for #{dimension}"
      db_execute_set parent_query, parent_set
    end
    mylogger :info, "done load_meta_csv for #{dimension}"
    true
  end

  def load_series_csv
    mylogger :info, 'starting load_series_csv'
    csv_dir_path = path(filename).change_file_extension('')
    csv_path = File.join(csv_dir_path, 'Data.csv')
    raise "File #{csv_path} not found" unless File.exists? csv_path

    dp_data_set = []
    CSV.foreach(csv_path, {col_sep: "\t", headers: true, return_headers: false}) do |row_pairs|
      row = {}
      row_pairs.to_a.each do |header, data|  ## convert row to hash keyed on column header, force blank/empty to nil
        next if header.blank?
        row[header.strip.downcase] = data.blank? ? nil : data.strip
      end
      next if row['value'].nil?
      break if row['module'].nil?  ## in case there are blank rows appended at the end
      row['date'] = make_date(row['year'].to_i, row['qm'].to_s)
      row_values = %w{module frequency date value
                              group module
                              market module
                              destination module
                              category module
                              indicator module}.map{|d| row[d] }
      dp_data_set.push row_values
    end

    dp_query = <<~MYSQL
      insert into data_points
        (`module`,`frequency`,`date`,`value`,`group_id`,`market_id`,`destination_id`,`category_id`,`indicator_id`)
      select ?, ?, ?, ?, g.id, m.id, d.id, c.id, i.id
        from indicators i
          left join `groups` g on g.handle = ? and g.module = ?
          left join markets m on m.handle = ? and m.module = ?
          left join destinations d on d.handle = ? and d.module = ?
          left join categories c on c.handle = ? and c.module = ?
       where i.handle = ?
         and i.module = ?;
    MYSQL
    ## This is likely to be slow... later work on a way to make it faster?
    ## Maybe add dimension handle columns to the data table, insert these, then convert to int IDs in postproc?
    dp_data_set.in_groups_of(1000, false) do |dps|
      db_execute_set dp_query, dps
    end
    mylogger :info, 'done load_series_csv'
  end

  def load_data_postproc
    ## Nothing to do at this time
  end

  def worker_tasks(do_csv_proc = false)
    csv_extract if do_csv_proc
    mylogger :debug, "before full_load"
    full_load && mylogger(:info, "loaded and active")
    self.update(series_status: :ok, last_error: nil, last_error_at: nil)
  end

private
  def csv_extract
    xls_path = absolute_path('series')
    csv_path = xls_path.change_file_extension('') ### truncate extension to make a directory name
    other_worker = ENV['OTHER_WORKER']

    unless File.exists?(xls_path)
      mylogger :warn, "xls file #{xls_path} does not exist"
      if other_worker.blank?
        raise "Could not find xlsx file ((#{xls_path}) #{id}) and no $OTHER_WORKER defined"
      end
      unless system("rsync -t #{other_worker + ':' + xls_path} #{upload.absolute_path}")
        raise "#{@logprefix}: Could not get xlsx file ((#{xls_path}) #{upload.id}) from $OTHER_WORKER: #{other_worker} (#{$?})"
      end
    end
    unless system "xlsx2csv.py -a -d tab -c utf-8  #{xls_path} #{csv_path}"
      raise "#{@logprefix}: Could not transform xlsx to csv (#{upload.id}:#{$?})"
    end
    if other_worker && !system("rsync -rt #{csv_path} #{other_worker + ':' + upload.absolute_path}")
      raise "#{@logprefix}: Could not copy #{csv_path} for #{upload.id} to $OTHER_WORKER: #{other_worker} (#{$?})"
    end
  end

  def path(name = nil)
    parts = [ENV['DATA_PATH'], 'dvw_files']
    parts.push(name) unless name.blank?
    File.join(parts)
  end

  def DvwUpload.make_filename(time, type, ext)
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

  ### This doesn't really do what it seems to be intended for, right? Check back into it later...
  ###
  def delete_data_and_data_sources
    db_execute <<~MYSQL
      DELETE FROM data_points
      WHERE data_source_id IN (SELECT id FROM data_sources WHERE eval LIKE 'DvwUpload.load(#{self.id},%)');
    MYSQL
  end

  def db_execute(query, values = [])
    stmt = DvwUpload.connection.raw_connection.prepare(query)
    stmt.execute(*values)  ## if you don't know what this * is, you can google for "ruby splat"
  end

  def db_execute_set(query, set)
    stmt = DvwUpload.connection.raw_connection.prepare(query)
    set.each {|values| stmt.execute(*values) }
  end

  def make_date(year, mq)
    month = 1
    begin
      if mq =~ /([MQ])(\d+)/i
        month = $1.upcase == 'M' ? $2.to_i : first_month_of_quarter($2)
      end
      '%d-%02d-01' % [year, month]
    rescue
      year_msg = year.blank? ? ' is empty' : "=#{year}"
      raise "Bad date params: year#{year_msg}, QM='#{mq}'"
    end
  end

  def incr_order(ohash, level)
    ## all lower levels get reset each time we increment a level
    (level+1..).each do |n|
      break if ohash[n].nil?
      ohash[n] = 0
    end
    ohash[level] += 1
  end

  def mylogger(level, message)
    Rails.logger.send(level) { "#{Time.now} DvwUpload id=#{self.id}: #{message}" }
  end
end
