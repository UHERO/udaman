# generates udaman_tsd files
class ExportWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform
    path = "#{ENV['DATA_PATH']}/BnkLists/"
    %w{bea_a bls_a census_a jp_a misc_a tax_a tour_a us_a
    bea_s bls_s
    bea_q bls_q census_q jp_q misc_q tax_q tour_q us_q
    bls_m jp_m misc_m tax_m tour_m us_m
    misc_w tour_w tour_d }.each do |bank|
      frequency_code = bank.split('_')[1].upcase
      filename = path + bank + '.txt'
      f = open filename
      list = f.read.split("\r\n")
      f.close
      list.map! {|name| "#{name}.#{frequency_code}"}
      Series.write_data_list_tsd list, "#{ENV['DATA_PATH']}/udaman_tsd/#{bank}.tsd"
    end
  end
end