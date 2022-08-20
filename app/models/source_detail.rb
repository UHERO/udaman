class SourceDetail < ApplicationRecord
  include Cleaning
  has_many :series
  has_many :measurements
  before_destroy :last_rites

  def to_s
    description
  end

private

  def last_rites
    unless Series.where(source_detail_id: id).empty?
      raise "Cannot destroy source detail '#{self}' (id=#{id}) because a Series is using it"
    end
    unless Measurement.where(source_detail_id: id).empty?
      raise "Cannot destroy source detail '#{self}' (id=#{id}) because a Measurement is using it"
    end
    Rails.logger.info { "DESTROY source detail '#{self}': completed" }
  end

end
