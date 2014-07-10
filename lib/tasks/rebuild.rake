# run REBUILD.rb line by line

task :rebuild => :environment do
    File.open('lib/tasks/REBUILD_DOWNLOADS.rb', 'r') do |file|
      while line = file.gets
         line.gsub! "/Volumes/UHEROwork", "/Users/uhero/Documents"
        eval(line)
      end
    end
    
    errors = []
    File.open('lib/tasks/REBUILD.rb', 'r') do |file|
      `chmod -R 777 /Users/uhero/Documents/data/*`
      while line = file.gets
        line.gsub! "/Volumes/UHEROwork", "/Users/uhero/Documents"
        line.gsub! "japan/seasadj/sadata.xls", "rawdata/sadata/japan.xls"
        line.gsub! "bls/seasadj/sadata.xls", "rawdata/sadata/bls.xls"
        line.gsub! "misc/hbr/seasadj/sadata.xls", "rawdata/sadata/misc_hbr.xls"
        line.gsub! "tour/seasadj/sadata.xls", "rawdata/sadata/tour.xls"
        line.gsub! "tax/seasadj/sadata.xls", "rawdata/sadata/tax.xls"
        line.gsub! "misc/prud/seasadj/prud_sa.xls", "rawdata/sadata/misc_prud_prud_sa.xls"
        line.gsub! "misc/hbr/seasadj/mbr_sa.xls", "rawdata/sadata/misc_hbr_mbr_sa.xls"
        line.gsub! "bls/seasadj/bls_wagesa.xls", "rawdata/sadata/bls_wages.xls"
        begin
          eval(line)
          print "."
        rescue Exception => exc
          puts line
          puts exc.message
          errors.push [line,exc.message]
        end
      end
    end
    
    CSV.open("public/rebuild_errors", "wb") {|file| errors.each {|e| file << e} }
    
end

task :test_case => :environment do
   "CPINS@US.M".tsn.load_from_bls("CUUR0000SA0", "M")
   "CPINS@US.Q".ts_eval= %Q|"CPINS@US.M".ts.aggregate(:quarter, :average)|
   "CPI@US.A".ts_eval= %Q|"CPINS@US.Q".ts.aggregate(:year, :average)|
end

task :output_active_downloads => :environment do
  File.open('lib/tasks/REBUILD_DOWNLOADS.rb', 'w') do |file|
    DsdLogEntry.maximum(:time, :group => :data_source_download_id).each do |dsd_id, time|
      if time > (Date.today - 10.day)
        puts "wrote: #{dsd_id}"
        file.puts DataSourceDownload.find(dsd_id).update_statement
      end
    end 
  end
end
