class ReloadJob < ApplicationRecord
  include Cleaning
  belongs_to :user
  has_many :reload_job_series, dependent: :delete_all
  has_many :series, -> {distinct}, through: :reload_job_series

end
