require "rails_helper"

RSpec.describe "/series", type: :request do
  # Include Devise test helpers for request specs, not controller specs
  include Devise::Test::IntegrationHelpers

  let(:valid_attributes) do
    series = Series.first
    series.attributes.symbolize_keys
  end

  # for testing an incorrect series
  # let(:invalid_attributes) { series = Series.first }

  let(:user) do
    # Create a real user for testing
    User.find_by(email: "test@example.com") ||
      User.create!(
        email: "test@example.com",
        password: "password123"
        # Add other required attributes for your User model
      )
  end

  before do
    # Method provided by Devise auth lib
    sign_in user
    # This allows all auth checks to pass, make more granular later
    allow_any_instance_of(SeriesController).to receive(
      :check_authorization
    ).and_return(true)
  end

  describe "GET /series" do
    it "renders a successful response" do
      get "/series"
      expect(response).to be_successful
    end
  end

  describe "GET /show" do
    it "renders a successful response" do
      id = valid_attributes[:id]
      get series_url(id: id)
      expect(response).to be_successful
    end
  end

  describe "GET /new" do
    it "renders a successful response" do
      get new_series_url
      expect(response).to be_successful
    end
  end

  describe "GET /edit" do
    it "renders a successful response" do
      id = valid_attributes[:id]
      get edit_series_url(id: id)
      expect(response).to be_successful
    end
  end

  describe "POST /create" do
    before do
      # Ensure test models exist
      @unit = Unit.first || create(:unit)
      @source = Source.first || create(:source)
      @geography = Geography.first || create(:geography)

      sign_in user
      allow_any_instance_of(SeriesController).to receive(
        :check_authorization
      ).and_return(true)
    end

    context "with valid parameters" do
      it "creates a new Series" do
        #enum type
        valid_seasonal_adjustment = Series.seasonal_adjustments.keys.first
        post_params = {
          series: {
            dataPortalName: "Test Series",
            description: "This is a test series description",
            unit_id: @unit.id,
            source_id: @source.id,
            decimals: 1,
            universe: "UHERO",
            xseries_attributes: {
              percent: false,
              real: false,
              seasonal_adjustment: "not_applicable",
              frequency_transform: "average",
              restricted: false
            }
          },
          name_parts: {
            prefix: "TEST",
            geography_id: @geography.id,
            freq: "A"
          }
        }

        # Call the endpoint
        post series_index_url, params: post_params

        # Debug information
        puts "Redirect location: #{response.location}"
        puts "Response status: #{response.status}"

        # If it's an error with an alert message
        if response.redirect? && response.location.include?("new")
          # Follow the redirect to see the error message
          follow_redirect!
          puts "Alert message: #{flash[:alert]}"
          puts "Page content excerpt: #{response.body[0..500]}"
        end

        # Our actual expectation - it shouldn't redirect back to new
        expect(response.location).not_to include("new")
      end
    end
  end

  #   context "with invalid parameters" do
  #     it "does not create a new Series" do
  #       expect {
  #         post series_index_url, params: { series: invalid_attributes }
  #       }.to change(Series, :count).by(0)
  #     end

  #     it "renders a successful response (i.e. to display the 'new' template)" do
  #       post series_index_url, params: { series: invalid_attributes }
  #       expect(response).to be_successful
  #     end
  #   end
  # end

  # describe "PATCH /update" do
  #   context "with valid parameters" do
  #     let(:new_attributes) do
  #       skip("Add a hash of attributes valid for your model")
  #     end

  #     it "updates the requested series" do
  #       series = Series.create! valid_attributes
  #       patch series_url(series), params: { series: new_attributes }
  #       series.reload
  #       skip("Add assertions for updated state")
  #     end

  #     it "redirects to the series" do
  #       series = Series.create! valid_attributes
  #       patch series_url(series), params: { series: new_attributes }
  #       series.reload
  #       expect(response).to redirect_to(series_url(series))
  #     end
  #   end

  #   context "with invalid parameters" do
  #     it "renders a successful response (i.e. to display the 'edit' template)" do
  #       series = Series.create! valid_attributes
  #       patch series_url(series), params: { series: invalid_attributes }
  #       expect(response).to be_successful
  #     end
  #   end
  # end

  # describe "DELETE /destroy" do
  #   it "destroys the requested series" do
  #     series = Series.create! valid_attributes
  #     expect { delete series_url(series) }.to change(Series, :count).by(-1)
  #   end

  #   it "redirects to the series list" do
  #     series = Series.create! valid_attributes
  #     delete series_url(series)
  #     expect(response).to redirect_to(series_index_url)
  #   end
  # end
end
