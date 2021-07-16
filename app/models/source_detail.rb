class SourceDetail < ApplicationRecord
  include Cleaning
  has_many :series
  has_many :measurements
  before_destroy :last_rites

private

  def last_rites
    unless Series.where(source_detail_id: id).empty?
      raise "Cannot destroy Source Detail #{self} (id=#{id}) because a Series is using it"
    end
    unless Measurement.where(source_detail_id: id).empty?
      raise "Cannot destroy Source Detail #{self} (id=#{id}) because a Measurement is using it"
    end
    Rails.logger.info { "DESTROY Source Detail #{self}: completed" }
  end

end
