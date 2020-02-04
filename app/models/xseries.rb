class Xseries < ApplicationRecord
  include Cleaning
  before_destroy :last_rites, prepend: true

  has_many :series, inverse_of: :xseries
  has_one :primary_series, class_name: 'Series'
  has_many :data_points, dependent: :delete_all

  serialize :factors, Hash

private
  def last_rites
    primary_series.reload rescue return
    Rails.logger.error { "ERROR: Cannot destroy xseries (id=#{id}) because its primary series still exists." }
    #errors.add(:base, 'Cannot destroy xseries when its primary series still exists.')
    throw(:abort)
  end

end
