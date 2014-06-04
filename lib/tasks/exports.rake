task :aremos_exports => :environment do
  t = Time.now
  #TOUR
  DataList.write "tour1", "/Users/uhero/Documents/data/udaman/tour1_UDA.xls" #8.9s
  DataList.write "tour2", "/Users/uhero/Documents/data/udaman/tour2_UDA.xls" #9.2s
  DataList.write "tour3", "/Users/uhero/Documents/data/udaman/tour3_UDA.xls" #6.7s
  DataList.write "tour_vrls", "/Users/uhero/Documents/data/udaman/tour_vrls_UDA.xls" #6.7s
  DataList.write "tour_ocup", "/Users/uhero/Documents/data/udaman/ocup_UDA.xls" 
  DataList.write "tour_vso", "/Users/uhero/Documents/data/udaman/vso_UDA.xls" 
  
  #BLS
  DataList.write "bls_job_m", "/Users/uhero/Documents/data/udaman/bls_job_m_UDA.xls" #25.5
  
  #pseudo spline
  DataList.write "famsize_q", "/Users/uhero/Documents/data/udaman/famsize_q.xls" #3.15
  DataList.write "famsize_a", "/Users/uhero/Documents/data/udaman/famsize_a.xls" #0.63

  #MISC
  DataList.write "const", "/Users/uhero/Documents/data/udaman/const.xls" #2.23

  
  CSV.open("public/rake_time.csv", "a") {|csv| csv << ["aremos_exports", "%.2f" % (Time.now - t) , t.to_s, Time.now.to_s] }
end

task :tsd_exports => :environment do
  t = Time.now
  path = "/Users/uhero/Documents/data/BnkLists/"
  [ "bea_a", "bls_a", "census_a", "jp_a", "misc_a", "tax_a", "tour_a", "us_a", 
    "bea_s", "bls_s", 
    "bea_q", "bls_q", "census_q", "jp_q", "misc_q", "tax_q", "tour_q", "us_q",
    "bls_m", "jp_m", "misc_m", "tax_m", "tour_m", "us_m",
    "misc_w", "tour_w", "tour_d" ].each do |bank|
  # ["misc_w"].each do |bank|
    # ["bls_m"].each do |bank|
    t = Time.now
    frequency_code = bank.split("_")[1].upcase
    filename = path + bank + ".txt"
    f = open filename
    list = f.read.split("\r\n")
    f.close
    list.map! {|name| "#{name}.#{frequency_code}"}
    Series.write_data_list_tsd list, "/Users/uhero/Documents/data/udaman_tsd/#{bank}.tsd"
    puts "#{ "%.2f" % (Time.now - t) } | #{ list.count } | #{ bank }"
    
  end
  CSV.open("public/rake_time.csv", "a") {|csv| csv << ["tsd_exports", "%.2f" % (Time.now - t) , t.to_s, Time.now.to_s] }
end

#redundant with prognoz diffs. Can delete, most likely
# task :prognoz_exports => :environment do
#   t = Time.now
#   
#   folder = "/Users/uhero/Documents/data/prognoz_export/"
#   filenames = ["Agriculture.xls", "CAFRCounties.xls", "Kauai.xls", "metatable_isdi.xls", "SourceDoc.xls", "TableTemplate.xls"]
#   filenames.map! {|elem| folder+elem}
#   
#   PrognozDataFile.all.each do |pdf| 
#     t1 = Time.now
#     pdf.write_export
#     filenames.push pdf.filename
#     puts "#{"%.2f" %(Time.now - t1)} | #{pdf.filename}"
#   end 
#   
#   Zip::ZipFile.open(folder + "ready_to_send_zip_files/" + Date.today.strftime("%yM%mD%d") + ".zip", Zip::ZipFile::CREATE) do |zipfile|
#     filenames.each {|fname| zipfile.add(fname.split("/")[-1], fname)}
#   end
#   
#   CSV.open("public/rake_time.csv", "a") {|csv| csv << ["prognoz_exports", "%.2f" % (Time.now - t) , t.to_s, Time.now.to_s] }
#   
# end
# task :prognoz_exports => :environment do
#   t = Time.now
#   DataList.write "prognoz_month1", "~/eis/data/12M09Atest/Data_month1.xls"
#   DataList.write "prognoz_month2", "~/eis/data/12M09Atest/Data_month2.xls"
#   DataList.write "prognoz_month3", "~/eis/data/12M09Atest/Data_month3.xls"
#   DataList.write "prognoz_month4", "~/eis/data/12M09Atest/Data_month4.xls"
#   DataList.write "prognoz_month5", "~/eis/data/12M09Atest/Data_month5.xls"
#   DataList.write "prognoz_month6", "~/eis/data/12M09Atest/Data_month6.xls"
#   DataList.write "prognoz_month7", "~/eis/data/12M09Atest/Data_month7.xls"
#   DataList.write "prognoz_annual1", "~/eis/data/12M09Atest/Data_annual1.xls"
#   DataList.write "prognoz_annual2", "~/eis/data/12M09Atest/Data_annual2.xls"
#   DataList.write "prognoz_quarter1", "~/eis/data/12M09Atest/Data_quarter1.xls"
#   CSV.open("public/rake_time.csv", "a") {|csv| csv << ["prognoz_expots", "%.2f" % (Time.now - t) , t.to_s, Time.now.to_s] }
# end

#23.93 | 200 | ~/eis/data/12M09Atest/Data_month1.xls21.10 | 200 | ~/eis/data/12M09Atest/Data_month2.xls20.30 | 200 | ~/eis/data/12M09Atest/Data_month3.xls18.74 | 199 | ~/eis/data/12M09Atest/Data_month4.xls11.65 | 130 | ~/eis/data/12M09Atest/Data_month5.xls10.29 | 149 | ~/eis/data/12M09Atest/Data_month6.xls14.09 | 56 | ~/eis/data/12M09Atest/Data_month7.xlsrake aborted!SeriesNameException
