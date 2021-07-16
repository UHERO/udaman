class Source < ApplicationRecord
  include Cleaning
  include Validators

  has_many :series
  has_many :measurements
  validate :link_is_valid
  before_destroy :last_rites

  def Source.get_or_new(description, link = nil, universe = 'UHERO')
    Source.find_by(universe: universe, description: description) ||
    (link && Source.find_by(universe: universe, link: link)) ||
    Source.create(universe: universe, description: description, link: link)
  end

private

  def link_is_valid
    link.blank? || valid_url(link) || errors.add(:link, 'is not a valid URL')
  end

  def last_rites
    unless Series.where(source_id: id).empty?
      raise "Cannot destroy Source #{self} (id=#{id}) because a Series is using it"
    end
    unless Measurement.where(source_id: id).empty?
      raise "Cannot destroy Source#{self} (id=#{id}) because a Measurement is using it"
    end
    Rails.logger.info { "DESTROY Source #{self}: completed" }
  end

end
